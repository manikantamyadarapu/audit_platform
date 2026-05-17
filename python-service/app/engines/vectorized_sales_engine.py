from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any, Sequence

import polars as pl

from app.core.issue_engine import messages_for_codes
from app.engines.vectorized_validation_engine import LoadedValidationSheet, VectorizedValidationEngine
from app.services.master_rule_service import MasterRuleService
from app.services.master_sales_rate_rule_service import MasterSalesRateRuleService
from app.utils.logger import get_logger
from app.utils.normalization_engine import (
    normalize_blankable_text_expr,
    normalize_blankable_voucher_expr,
    normalize_voucher_expr,
)

_EMPTY_TOKENS = frozenset({'', 'pending', 'na', 'n/a', 'none', 'null', 'nan', '-', '----'})
_REQUIRED = frozenset({'voucher_no', 'sales_account', 'product', 'unit_rate'})
_HEADER_CORE = frozenset({'voucher_no', 'sales_account', 'product', 'unit_rate'})
_DEBUG_DIR = Path(__file__).resolve().parents[1] / 'debug'

_MASTER_RATE_DEVIATION_PERCENT = 30.0
_MASTER_RATE_VALIDATION_SOURCE = 'master_sales_rate_rules'
_PARTY_DISPLAY_SOURCE_COLUMNS = (
    'name_of_the_party',
    'customer_name',
    'party_name',
    'bill_to_party',
    'bill_party',
)


def _resolve_party_display_column(columns: Sequence[str]) -> str | None:
    return next((c for c in _PARTY_DISPLAY_SOURCE_COLUMNS if c in columns), None)


def _strict_unsigned_number_expr(raw: pl.Expr) -> pl.Expr:
    stripped = (
        raw.cast(pl.Utf8, strict=False)
        .fill_null('')
        .str.to_uppercase()
        .str.replace_all(',', '')
        .str.replace_all(r'[^0-9.\-]', '')
        .str.replace_all(r'\s+', '')
    )
    return (
        pl.when(raw.cast(pl.Utf8, strict=False).fill_null('').str.contains(r'[A-Za-z]'))
        .then(None)
        .when(stripped.str.len_chars() == 0)
        .then(None)
        .when(~stripped.str.contains(r'^\d+(\.\d+)?$'))
        .then(None)
        .otherwise(stripped.cast(pl.Float64, strict=False))
    )


def _sales_business_skip_expr() -> pl.Expr:
    sa = pl.col('__sales_account_norm').fill_null('')
    pr = pl.col('__product_norm').fill_null('')
    return (
        (sa == 'REPAIR CHARGES')
        | (pr == 'REPAIR CHARGES')
        | (sa == 'ROUND OFF')
        | (pr == 'ROUND OFF')
        | (sa == 'DISCOUNT')
        | (pr == 'DISCOUNT')
        | (sa == 'TOTAL')
        | (pr == 'TOTAL')
        | sa.str.contains(r'^TOTAL\s')
        | pr.str.contains(r'^TOTAL\s')
        | sa.str.contains(r'\sTOTAL$')
        | pr.str.contains(r'\sTOTAL$')
        | sa.str.contains('SUBTOTAL')
        | pr.str.contains('SUBTOTAL')
    )


_JEWEL_RATE_ACCOUNTS_SQL = (
    '('
    + ', '.join(
        f"'{name}'"
        for name in (
            'JEWELS SALES ACCOUNT - COLOR STONES',
            'JEWELS SALES ACCOUNT - PEARLS',
            'JEWELS SALES ACCOUNT - EMERALDS',
            'JEWELS SALES ACCOUNT - RUBIES',
        )
    )
    + ')'
)
_RATE_SKIP_PRODUCTS_SQL = (
    '('
    + ', '.join(
        f"'{name}'"
        for name in (
            'CUSTOMER RUBIES',
            'CUSTOMER PEARLS',
            'CUSTOMER EMERALDS',
            'CUSTOMER STONES',
            'RUBIES JRU MIX',
            'EMERALDS JEM MIX',
            'RUBIES JRU LOOSE 33500',
            'EMERALDS JEM LOOSE 22000',
        )
    )
    + ')'
)
_RATE_SKIP_LOOSE_SQL = (
    "COALESCE(v.product_norm, '') LIKE '% LOOSE %' "
    "OR COALESCE(v.product_norm, '') LIKE '% LOOSE'"
)


@dataclass(slots=True)
class SalesValidationResult:
    total_rows: int
    summary: dict[str, Any]
    records: list[dict[str, Any]]
    header_row_index: int
    header_detection_ms: float
    load_ms: float
    validation_ms: float
    extraction_ms: float
    total_ms: float


def _sales_header_row_matches(labels: set[str]) -> bool:
    return _HEADER_CORE <= labels


class VectorizedSalesEngine:
    REQUIRED_COLUMNS = _REQUIRED

    def __init__(
        self,
        master_rule_service: MasterRuleService | None = None,
        rate_rule_service: MasterSalesRateRuleService | None = None,
    ) -> None:
        self.loader = VectorizedValidationEngine('sales')
        self.master_rule_service = master_rule_service or MasterRuleService()
        self.rate_rule_service = rate_rule_service or MasterSalesRateRuleService()
        self._log = get_logger()

    def load_sales_sheet(self, file_bytes: bytes) -> LoadedValidationSheet:
        loaded = self.loader.load_sheet(file_bytes, row_matches=_sales_header_row_matches, scan_limit=100)
        dataframe = self._canonicalize_upload_columns(loaded.dataframe)
        self._log.info(
            f"[sales] detected header row={loaded.header_row_index + 1} "
            f"columns={self.loader.user_columns(dataframe)}"
        )
        return LoadedValidationSheet(
            dataframe=dataframe,
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
        )

    def validate(self, file_bytes: bytes) -> SalesValidationResult:
        loaded = self.load_sales_sheet(file_bytes)
        return self.validate_loaded_sheet(loaded)

    def validate_loaded_sheet(self, loaded: LoadedValidationSheet) -> SalesValidationResult:
        total_start = perf_counter()
        sales_df = loaded.dataframe
        master_rules = self.master_rule_service.load_master_rules()
        self._log.info(
            f"[sales] total master rules loaded={len(master_rules)} total uploaded rows={len(sales_df)}"
        )

        validation_start = perf_counter()
        enriched_df = self._enrich_sales_dataframe(sales_df)
        rate_rules = self.rate_rule_service.load_rate_rules()
        self._log.info(f'[sales] total product rate rules loaded={len(rate_rules)}')
        with self.loader.duckdb_connection(enriched_df) as connection:
            connection.register('master_rules', master_rules.to_arrow())
            connection.register('rate_rules', rate_rules.to_arrow())
            try:
                summary_row = self.loader.fetch_frame(connection, self._summary_sql()).to_dicts()[0]
                invalid_rows = self.loader.fetch_frame(connection, self._invalid_rows_sql()).to_dicts()
            finally:
                connection.unregister('master_rules')
                connection.unregister('rate_rules')
        validation_ms = (perf_counter() - validation_start) * 1000
        self._write_debug_exports(enriched_df=enriched_df)

        extraction_start = perf_counter()
        records = [self._record_from_row(row) for row in invalid_rows]
        summary = {
            'invalidSalesAccounts': int(summary_row['invalid_sales_accounts']),
            'invalidProductMappings': int(summary_row['invalid_product_mappings']),
            'productsNotFoundInMaster': int(summary_row['products_not_found_in_master']),
            'rateMasterNotFound': int(summary_row['rate_master_not_found']),
            'rateDeviationViolations': int(summary_row['rate_deviation_violations']),
        }
        extraction_ms = (perf_counter() - extraction_start) * 1000
        self._log.info(
            "[sales] unmatched sales accounts={invalidSalesAccounts} unmatched products={productsNotFoundInMaster} "
            "failed joins={invalidProductMappings} extracted invalid rows count={invalid_count}".format(
                invalid_count=len(records), **summary
            )
        )
        self._log.info(
            '[sales] transaction rows={txn} of {total} (debug csv app/debug/sales_transaction_pipeline.csv)'.format(
                txn=int(enriched_df['__is_transaction_row'].sum()),
                total=len(enriched_df),
            )
        )

        total_ms = (perf_counter() - total_start) * 1000
        self.loader.log_benchmark(
            row_count=len(sales_df),
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
            validation_ms=validation_ms,
            extraction_ms=extraction_ms,
            total_ms=total_ms,
        )
        return SalesValidationResult(
            total_rows=int(summary_row['data_rows']),
            summary=summary,
            records=records,
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
            validation_ms=validation_ms,
            extraction_ms=extraction_ms,
            total_ms=total_ms,
        )

    def _canonicalize_upload_columns(self, dataframe: pl.DataFrame) -> pl.DataFrame:
        renames: dict[str, str] = {}
        if 'unitrate' in dataframe.columns and 'unit_rate' not in dataframe.columns:
            renames['unitrate'] = 'unit_rate'
        if 'rate' in dataframe.columns and 'unit_rate' not in dataframe.columns:
            renames['rate'] = 'unit_rate'
        if 'qty' in dataframe.columns and 'quantity' not in dataframe.columns:
            renames['qty'] = 'quantity'
        return dataframe.rename(renames) if renames else dataframe

    @staticmethod
    def _freeze_upload_row_identity(dataframe: pl.DataFrame) -> pl.DataFrame:
        """Immutable Excel row number and raw cell snapshots — never recomputed after load."""
        if 'source_excel_row_number' not in dataframe.columns:
            if '__excel_row_number__' in dataframe.columns:
                dataframe = dataframe.with_columns(
                    pl.col('__excel_row_number__').alias('source_excel_row_number')
                )
            else:
                raise ValueError('Upload sheet is missing source_excel_row_number from loader')

        freeze_exprs: list[pl.Expr] = [
            pl.col('source_excel_row_number').cast(pl.Int64).alias('__source_excel_row_number'),
        ]
        for column, alias in (
            ('sales_account', '__original_excel_sales_account'),
            ('product', '__original_excel_product'),
            ('unit_rate', '__original_excel_unit_rate'),
        ):
            if column in dataframe.columns:
                freeze_exprs.append(
                    pl.col(column).cast(pl.Utf8, strict=False).fill_null('').alias(alias)
                )
        return dataframe.with_columns(freeze_exprs)

    def _enrich_sales_dataframe(self, dataframe: pl.DataFrame) -> pl.DataFrame:
        dataframe = self._freeze_upload_row_identity(dataframe)
        data_columns = self.loader.user_columns(dataframe)
        qty_col: str | None = 'quantity' if 'quantity' in data_columns else None
        party_col = _resolve_party_display_column(data_columns)

        blank_checks: list[pl.Expr] = []
        for column in data_columns:
            if column == 'voucher_no':
                blank_checks.append(normalize_blankable_voucher_expr(column).is_null())
            else:
                blank_checks.append(normalize_blankable_text_expr(column).is_null())

        qty_raw_expr = (
            pl.col(qty_col).cast(pl.Utf8, strict=False).fill_null('') if qty_col else pl.lit('')
        )
        parsed_qty_expr = (
            _strict_unsigned_number_expr(pl.col(qty_col).cast(pl.Utf8, strict=False))
            if qty_col
            else pl.lit(None).cast(pl.Float64)
        )

        stripped_rate = (
            pl.col('__unit_rate_raw')
            .str.to_uppercase()
            .str.replace_all(',', '')
            .str.replace_all(r'[^0-9.\-]', '')
            .str.replace_all(r'\s+', '')
        )
        uploaded_unit_rate = (
            pl.when(pl.col('__unit_rate_raw').str.contains(r'[A-Za-z]'))
            .then(None)
            .when(pl.col('__unit_rate_text').is_null())
            .then(None)
            .when(stripped_rate.str.len_chars() == 0)
            .then(None)
            .when(~stripped_rate.str.contains(r'^\-?\d+(\.\d+)?$'))
            .then(None)
            .otherwise(stripped_rate.cast(pl.Float64, strict=False))
            .alias('__uploaded_unit_rate')
        )
        rate_validation_source = (
            pl.when(pl.col('__uploaded_unit_rate').is_not_null() & (pl.col('__uploaded_unit_rate') > 0))
            .then(pl.lit(_MASTER_RATE_VALIDATION_SOURCE))
            .otherwise(pl.lit('skipped'))
            .alias('__rate_validation_source')
        )

        raw_row_json = (
            pl.struct([pl.col(c).cast(pl.Utf8, strict=False).fill_null('') for c in data_columns])
            .struct.json_encode()
            .alias('__raw_excel_row_json')
        )

        party_display = (
            pl.col(party_col).cast(pl.Utf8, strict=False).fill_null('').str.strip_chars().alias('__party_display')
            if party_col
            else pl.lit('').alias('__party_display')
        )

        is_business_skip = _sales_business_skip_expr().alias('__is_business_skip_row')
        has_voucher = normalize_blankable_voucher_expr('voucher_no').is_not_null()
        has_sales = normalize_blankable_text_expr('sales_account').is_not_null()
        has_product = normalize_blankable_text_expr('product').is_not_null()
        qty_ok = parsed_qty_expr.is_not_null() & (parsed_qty_expr > 0)
        is_transaction_row = (
            has_voucher
            & has_sales
            & has_product
            & qty_ok
            & ~pl.col('__is_business_skip_row')
        ).alias('__is_transaction_row')

        return (
            dataframe.with_columns(
                [
                    raw_row_json,
                    party_display,
                    pl.col('voucher_no')
                    .cast(pl.Utf8, strict=False)
                    .fill_null('')
                    .str.strip_chars()
                    .alias('__voucher_display'),
                    normalize_voucher_expr('voucher_no').alias('__voucher_norm'),
                    normalize_blankable_text_expr('sales_account').alias('__sales_account_text'),
                    normalize_blankable_text_expr('product').alias('__product_text'),
                    normalize_blankable_text_expr('unit_rate').alias('__unit_rate_text'),
                    pl.all_horizontal(blank_checks).alias('__is_blank_row'),
                    normalize_blankable_text_expr('sales_account').alias('__sales_account_norm'),
                    normalize_blankable_text_expr('product').alias('__product_norm'),
                    pl.col('unit_rate').cast(pl.Utf8, strict=False).fill_null('').alias('__unit_rate_raw'),
                    qty_raw_expr.alias('__raw_quantity'),
                    parsed_qty_expr.alias('__parsed_quantity'),
                ]
            )
            .with_columns([uploaded_unit_rate])
            .with_columns([rate_validation_source])
            .with_columns([is_business_skip])
            .with_columns([is_transaction_row])
        )

    @staticmethod
    def _rate_difference(row: dict[str, Any]) -> float | None:
        uploaded = row.get('uploaded_unit_rate')
        standard = row.get('master_standard_rate')
        if uploaded is None or standard is None:
            return None
        try:
            return round(float(uploaded) - float(standard), 4)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _deviation_percent(row: dict[str, Any]) -> float | None:
        uploaded = row.get('uploaded_unit_rate')
        standard = row.get('master_standard_rate')
        if uploaded is None or standard is None:
            return None
        try:
            standard_f = float(standard)
            if standard_f == 0:
                return None
            return round(((float(uploaded) - standard_f) / standard_f) * 100, 2)
        except (TypeError, ValueError):
            return None

    def _record_from_row(self, row: dict[str, Any]) -> dict[str, Any]:
        issues: list[str] = []
        if row.get('invalid_sales_account'):
            issues.append('INVALID_SALES_ACCOUNT')
        if row.get('product_not_found'):
            issues.append('PRODUCT_NOT_FOUND_IN_MASTER')
        elif row.get('invalid_product_mapping'):
            issues.append('INVALID_PRODUCT_MAPPING')
        if row.get('rate_master_not_found'):
            issues.append('RATE_MASTER_NOT_FOUND')
        if row.get('invalid_rate_deviation'):
            issues.append('INVALID_RATE_DEVIATION')

        excel_row = int(row['source_excel_row_number'])
        return {
            'rowNumber': excel_row,
            'rowId': excel_row,
            'sourceExcelRowNumber': excel_row,
            'voucherNo': row.get('voucher_text') or '',
            'voucherNorm': row.get('voucher_norm') or '',
            'partyName': row.get('party_name') or '',
            'originalExcelSalesAccount': row.get('original_excel_sales_account') or '',
            'originalExcelProduct': row.get('original_excel_product') or '',
            'originalExcelUnitRate': row.get('original_excel_unit_rate') or '',
            'validationSalesAccount': row.get('validation_sales_account') or '',
            'validationProduct': row.get('validation_product') or '',
            'salesAccount': row.get('validation_sales_account') or row.get('sales_account') or '',
            'product': row.get('validation_product') or row.get('product') or '',
            'unitRate': row.get('uploaded_unit_rate'),
            'uploadedUnitRate': row.get('uploaded_unit_rate'),
            'uploadedRate': row.get('uploaded_unit_rate'),
            'masterStandardRate': row.get('master_standard_rate'),
            'standardRate': row.get('master_standard_rate'),
            'minAllowedRate': row.get('min_allowed_rate'),
            'maxAllowedRate': row.get('max_allowed_rate'),
            'deviationPercent': self._deviation_percent(row),
            'rateDifference': self._rate_difference(row),
            'rateValidationSource': row.get('rate_validation_source'),
            'quantity': row.get('parsed_quantity'),
            'rawQuantity': row.get('raw_quantity'),
            'parsedQuantity': row.get('parsed_quantity'),
            'rawUnitRate': row.get('raw_unit_rate'),
            'rawExcelRowJson': row.get('raw_excel_row_json'),
            'issues': issues,
            'messages': messages_for_codes(issues),
        }

    def _write_debug_exports(self, *, enriched_df: pl.DataFrame) -> None:
        _DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        export_cols = [
            c
            for c in enriched_df.columns
            if c.startswith('__')
            or c
            in (
                'voucher_no',
                'sales_account',
                'product',
                'name_of_the_party',
                'quantity',
                'unit_rate',
                'net_amount',
                'amount',
            )
        ]
        enriched_df.select(export_cols).write_csv(_DEBUG_DIR / 'sales_transaction_pipeline.csv')

    @staticmethod
    def _rate_check_ready_sql(prefix: str = 're') -> str:
        p = prefix
        return (
            f"COALESCE({p}.rate_validation_source, 'skipped') = '{_MASTER_RATE_VALIDATION_SOURCE}' "
            f'AND {p}.uploaded_unit_rate IS NOT NULL AND {p}.uploaded_unit_rate > 0'
        )

    def _validation_cte_sql(self, *, full: bool = False) -> str:
        blank_row_sql = self.loader.blank_row_sql(
            ['voucher_no', 'sales_account', 'product', 'unit_rate'],
            empty_tokens=_EMPTY_TOKENS,
        )
        repeated_header_sql = "(" + " OR ".join(
            [
                f"{self.loader.header_normalized_sql('voucher_no')} = 'voucher_no'",
                f"{self.loader.header_normalized_sql('sales_account')} = 'sales_account'",
                f"{self.loader.header_normalized_sql('product')} = 'product'",
                f"{self.loader.header_normalized_sql('unit_rate')} = 'unit_rate'",
            ]
        ) + ")"
        core = f"""
WITH cleaned AS (
    SELECT
        CAST("__source_excel_row_number" AS BIGINT) AS source_excel_row_number,
        CAST("__source_excel_row_number" AS BIGINT) AS row_number,
        CAST("__raw_excel_row_json" AS VARCHAR) AS raw_excel_row_json,
        CAST("__original_excel_sales_account" AS VARCHAR) AS original_excel_sales_account,
        CAST("__original_excel_product" AS VARCHAR) AS original_excel_product,
        CAST("__original_excel_unit_rate" AS VARCHAR) AS original_excel_unit_rate,
        "__voucher_display" AS voucher_text,
        "__voucher_norm" AS voucher_norm,
        "__sales_account_text" AS validation_sales_account,
        "__product_text" AS validation_product,
        CAST("__party_display" AS VARCHAR) AS party_name,
        TRY_CAST("__uploaded_unit_rate" AS DOUBLE) AS uploaded_unit_rate,
        "__sales_account_norm" AS sales_account_norm,
        "__product_norm" AS product_norm,
        TRY_CAST("__parsed_quantity" AS DOUBLE) AS parsed_quantity,
        CAST("__raw_quantity" AS VARCHAR) AS raw_quantity,
        CAST("__unit_rate_raw" AS VARCHAR) AS raw_unit_rate,
        CAST("__rate_validation_source" AS VARCHAR) AS rate_validation_source,
        COALESCE(CAST("__is_transaction_row" AS BOOLEAN), FALSE) AS is_transaction_row,
        COALESCE(CAST("__is_business_skip_row" AS BOOLEAN), FALSE) AS is_business_skip_row,
        {blank_row_sql} AS is_blank_row,
        {repeated_header_sql} AS is_repeated_header
    FROM source_rows
),
sales_account_master AS (
    SELECT DISTINCT normalized_sales_account
    FROM master_rules
    WHERE normalized_sales_account IS NOT NULL
),
product_master AS (
    SELECT DISTINCT normalized_product
    FROM master_rules
    WHERE normalized_product IS NOT NULL
),
validated AS (
    SELECT
        c.*,
        EXISTS (
            SELECT 1
            FROM sales_account_master AS sa
            WHERE sa.normalized_sales_account = c.sales_account_norm
        ) AS sales_account_exists,
        EXISTS (
            SELECT 1
            FROM product_master AS pm
            WHERE pm.normalized_product = c.product_norm
        ) AS product_exists,
        EXISTS (
            SELECT 1
            FROM master_rules AS mr
            WHERE mr.normalized_sales_account = c.sales_account_norm
                AND mr.normalized_product = c.product_norm
        ) AS exact_mapping_exists,
        (
            EXISTS (
                SELECT 1
                FROM sales_account_master AS sa
                WHERE sa.normalized_sales_account = c.sales_account_norm
            )
            AND EXISTS (
                SELECT 1
                FROM product_master AS pm
                WHERE pm.normalized_product = c.product_norm
            )
            AND EXISTS (
                SELECT 1
                FROM master_rules AS mr
                WHERE mr.normalized_sales_account = c.sales_account_norm
                    AND mr.normalized_product = c.product_norm
            )
        ) AS mapping_ok
    FROM cleaned AS c
)"""
        if not full:
            return core
        return (
            core
            + f"""
,
rate_enriched AS (
    SELECT
        v.*,
        (
            SELECT rr.standard_rate
            FROM rate_rules AS rr
            WHERE rr.normalized_sales_account = v.sales_account_norm
                AND rr.normalized_product = v.product_norm
            LIMIT 1
        ) AS master_standard_rate,
        (
            SELECT rr.standard_rate * 0.70
            FROM rate_rules AS rr
            WHERE rr.normalized_sales_account = v.sales_account_norm
                AND rr.normalized_product = v.product_norm
            LIMIT 1
        ) AS min_allowed_rate,
        (
            SELECT rr.standard_rate * 1.30
            FROM rate_rules AS rr
            WHERE rr.normalized_sales_account = v.sales_account_norm
                AND rr.normalized_product = v.product_norm
            LIMIT 1
        ) AS max_allowed_rate,
        CAST({_MASTER_RATE_DEVIATION_PERCENT} AS DOUBLE) AS allowed_deviation_percent,
        (v.sales_account_norm IN {_JEWEL_RATE_ACCOUNTS_SQL}) AS is_jewel_rate_account,
        (
            v.product_norm IN {_RATE_SKIP_PRODUCTS_SQL}
            OR {_RATE_SKIP_LOOSE_SQL}
        ) AS is_rate_skip_product
    FROM validated AS v
),
adjudicated AS (
    SELECT
        re.*,
        (
            re.mapping_ok
            AND re.is_jewel_rate_account
            AND NOT re.is_rate_skip_product
            AND {self._rate_check_ready_sql('re')}
            AND re.master_standard_rate IS NULL
        ) AS rate_master_not_found,
        (
            re.mapping_ok
            AND re.is_jewel_rate_account
            AND NOT re.is_rate_skip_product
            AND {self._rate_check_ready_sql('re')}
            AND re.master_standard_rate IS NOT NULL
            AND (
                re.uploaded_unit_rate < re.min_allowed_rate
                OR re.uploaded_unit_rate > re.max_allowed_rate
            )
        ) AS invalid_rate_deviation
    FROM rate_enriched AS re
)"""
        )

    def _summary_sql(self) -> str:
        return (
            self._validation_cte_sql(full=True)
            + """
SELECT
    SUM(
        CASE
            WHEN is_transaction_row AND NOT is_blank_row AND NOT is_repeated_header THEN 1
            ELSE 0
        END
    ) AS data_rows,
    SUM(
        CASE
            WHEN is_transaction_row AND NOT is_blank_row AND NOT is_repeated_header AND NOT sales_account_exists THEN 1
            ELSE 0
        END
    )
        AS invalid_sales_accounts,
    SUM(
        CASE
            WHEN is_transaction_row AND NOT is_blank_row AND NOT is_repeated_header
                AND sales_account_exists
                AND product_exists
                AND NOT exact_mapping_exists
            THEN 1
            ELSE 0
        END
    ) AS invalid_product_mappings,
    SUM(
        CASE
            WHEN is_transaction_row AND NOT is_blank_row AND NOT is_repeated_header AND NOT product_exists THEN 1
            ELSE 0
        END
    ) AS products_not_found_in_master,
    SUM(
        CASE
            WHEN is_transaction_row AND NOT is_blank_row AND NOT is_repeated_header
                AND rate_master_not_found
            THEN 1
            ELSE 0
        END
    ) AS rate_master_not_found,
    SUM(
        CASE
            WHEN is_transaction_row AND NOT is_blank_row AND NOT is_repeated_header
                AND invalid_rate_deviation
            THEN 1
            ELSE 0
        END
    ) AS rate_deviation_violations
FROM adjudicated
"""
        )

    def _invalid_rows_sql(self) -> str:
        return (
            self._validation_cte_sql(full=True)
            + """
SELECT
    source_excel_row_number AS row_number,
    source_excel_row_number,
    raw_excel_row_json,
    original_excel_sales_account,
    original_excel_product,
    original_excel_unit_rate,
    validation_sales_account,
    validation_product,
    voucher_text,
    voucher_norm,
    party_name,
    uploaded_unit_rate,
    raw_quantity,
    parsed_quantity,
    raw_unit_rate,
    rate_validation_source,
    master_standard_rate,
    min_allowed_rate,
    max_allowed_rate,
    allowed_deviation_percent,
    (NOT sales_account_exists) AS invalid_sales_account,
    (NOT product_exists) AS product_not_found,
    (
        sales_account_exists
        AND product_exists
        AND NOT exact_mapping_exists
    ) AS invalid_product_mapping,
    rate_master_not_found,
    invalid_rate_deviation
FROM adjudicated
WHERE
    is_transaction_row
    AND NOT is_blank_row
    AND NOT is_repeated_header
    AND (
        NOT sales_account_exists
        OR NOT product_exists
        OR (
            sales_account_exists
            AND product_exists
            AND NOT exact_mapping_exists
        )
        OR rate_master_not_found
        OR invalid_rate_deviation
    )
ORDER BY source_excel_row_number
"""
        )

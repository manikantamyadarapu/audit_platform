from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any, Sequence

import polars as pl

from app.config.settings import get_settings
from app.engines.vectorized_validation_engine import LoadedValidationSheet, VectorizedValidationEngine
from app.sales_engine.engine.audit_workbook import write_sales_audit_workbook
from app.sales_engine.engine.debug_trace import attach_debug_identity_columns, write_sales_audit_debug_workbook
from app.sales_engine.engine.reconciliation import log_reconciliation, reconcile_adjudicated_frame
from app.sales_engine.parsers.product_category import (
    account_category_expr,
    detected_category_expr,
    gem_slab_shape_expr,
    slab_family_expr,
)
from app.sales_engine.validators.audit_trace import audit_flag_columns, audit_trace_columns
from app.sales_engine.parsers.metal_rate import metal_rate_applies_expr, product_rule_book_rate_expr
from app.sales_engine.validators.gemstone_rate_validator import enrich_rate_columns
from app.sales_engine.validators.mapping_validator import mapping_valid_expr, sales_account_canonical_expr
from app.sales_engine.validators.metal_rate_validator import (
    combine_rate_validation_columns,
    enrich_metal_rate_columns,
)
from app.utils.constants import SALES_ISSUE_MESSAGES
from app.utils.logger import get_logger
from app.utils.normalization_engine import (
    normalize_blankable_text_expr,
    normalize_blankable_voucher_expr,
    normalize_voucher_expr,
)

_EMPTY_TOKENS = frozenset({'', 'pending', 'na', 'n/a', 'none', 'null', 'nan', '-', '----'})
_REQUIRED = frozenset({'voucher_no', 'sales_account', 'product', 'unit_rate'})
_HEADER_CORE = frozenset({'voucher_no', 'sales_account', 'product', 'unit_rate'})
_DEBUG_DIR = Path(__file__).resolve().parents[2] / 'debug'
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


def _sales_header_row_matches(labels: set[str]) -> bool:
    return _HEADER_CORE <= labels


def _messages_for_issues(codes: list[str]) -> list[str]:
    return [SALES_ISSUE_MESSAGES.get(code, code) for code in codes]


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


class VectorizedSalesEngine:
    """Official jewelry sales ledger engine: mapping + gemstone slab rate only."""

    REQUIRED_COLUMNS = _REQUIRED

    def __init__(self) -> None:
        self.loader = VectorizedValidationEngine('sales')
        self._log = get_logger()
        settings = get_settings()
        self._debug_export = settings.debug_exports_enabled()

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
        self._log.info(f'[sales] official mappings engine uploaded rows={len(sales_df)}')

        validation_start = perf_counter()
        enriched_df = self._enrich_sales_dataframe(sales_df)
        adjudicated = attach_debug_identity_columns(self._adjudicate(enriched_df))
        reconciliation = reconcile_adjudicated_frame(adjudicated)
        log_reconciliation(reconciliation, logger=self._log)
        validation_ms = (perf_counter() - validation_start) * 1000

        audit_counts: dict[str, int] = {}
        if self._debug_export:
            debug_path = _DEBUG_DIR / 'sales_audit_debug.xlsx'
            write_sales_audit_debug_workbook(adjudicated, debug_path)
            self._log.info('[sales] wrote row-preserving debug export path={path}'.format(path=debug_path))
            debug_start = perf_counter()
            audit_counts = self._write_debug_exports(adjudicated_df=adjudicated)
            self._log.info(
                '[sales] legacy debug export ms={:.2f}'.format((perf_counter() - debug_start) * 1000)
            )

        extraction_start = perf_counter()
        txn_mask = (
            pl.col('__is_transaction_row').fill_null(False)
            & ~pl.col('__is_blank_row').fill_null(False)
            & ~pl.col('__is_repeated_header').fill_null(False)
        )
        txn_df = adjudicated.filter(txn_mask)
        invalid_df = txn_df.filter(
            pl.col('__invalid_product_mapping').fill_null(False)
            | pl.col('__invalid_product_pattern').fill_null(False)
            | pl.col('__invalid_rate_deviation').fill_null(False)
        )
        records = self._records_from_invalid_frame(invalid_df)
        extraction_ms = (perf_counter() - extraction_start) * 1000

        recon = reconciliation.to_dict()
        summary = {
            'invalidSalesAccounts': 0,
            'invalidProductMappings': recon['invalidProductMappings'],
            'invalidProductPatterns': recon['invalidProductPatterns'],
            'productsNotFoundInMaster': 0,
            'rateMasterNotFound': 0,
            'rateDeviationViolations': recon['rateDeviationViolations'],
            'distinctInvalidRows': recon['totalInvalidRows'],
            'errorRowsCount': recon['totalInvalidRows'],
            'reconciliation': recon,
            'auditTraceSummary': audit_counts,
        }

        self._log.info(
            '[sales] invalid export records={records} (row-preserving, no dedup)'.format(
                records=len(records)
            )
        )
        self._log.info(
            '[sales] transaction rows={txn} of {total}'.format(
                txn=int(
                    adjudicated.filter(
                        pl.col('__is_transaction_row').fill_null(False)
                        & ~pl.col('__is_blank_row').fill_null(False)
                        & ~pl.col('__is_repeated_header').fill_null(False)
                    ).height
                ),
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
            total_rows=int(txn_df.height),
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

        if self._debug_export:
            row_json_expr = (
                pl.struct([pl.col(c).cast(pl.Utf8, strict=False).fill_null('') for c in data_columns])
                .struct.json_encode()
                .alias('__raw_excel_row_json')
            )
        else:
            row_json_expr = pl.lit('').alias('__raw_excel_row_json')

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

        repeated_header = (
            (normalize_blankable_voucher_expr('voucher_no') == 'VOUCHER_NO')
            | (normalize_blankable_text_expr('sales_account') == 'SALES_ACCOUNT')
            | (normalize_blankable_text_expr('product') == 'PRODUCT')
            | (normalize_blankable_text_expr('unit_rate') == 'UNIT_RATE')
        ).alias('__is_repeated_header')

        return (
            dataframe.with_columns(
                [
                    row_json_expr,
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
                    parsed_qty_expr.alias('__parsed_quantity'),
                ]
            )
            .with_columns([uploaded_unit_rate])
            .with_columns([is_business_skip])
            .with_columns([is_transaction_row, repeated_header])
        )

    def _adjudicate(self, enriched_df: pl.DataFrame) -> pl.DataFrame:
        return (
            enriched_df.with_columns([sales_account_canonical_expr()])
            .with_columns(
                [
                    account_category_expr(),
                    detected_category_expr(),
                    gem_slab_shape_expr(),
                    slab_family_expr(product_col='__product_norm'),
                ]
            )
            .with_columns([mapping_valid_expr()])
            .with_columns(audit_flag_columns(product_col='__product_norm'))
            .with_columns([product_rule_book_rate_expr(product_col='__product_norm')])
            .with_columns([metal_rate_applies_expr(product_col='__product_norm')])
            .with_columns(
                enrich_rate_columns(
                    uploaded_unit_rate_col='__uploaded_unit_rate',
                    product_col='__product_norm',
                    family_col='__slab_family',
                )
            )
            .with_columns(
                [
                    (
                        pl.col('__gem_rate_invalid_raw').fill_null(False) & ~pl.col('__has_mix')
                    ).alias('__gem_rate_invalid_raw'),
                ]
            )
            .with_columns(enrich_metal_rate_columns(uploaded_unit_rate_col='__uploaded_unit_rate'))
            .with_columns(
                combine_rate_validation_columns(
                    uploaded_unit_rate_col='__uploaded_unit_rate',
                    product_col='__product_norm',
                    family_col='__slab_family',
                )
            )
            .with_columns(audit_trace_columns())
        )

    def _records_from_invalid_frame(self, invalid_df: pl.DataFrame) -> list[dict[str, Any]]:
        """One API record per adjudicated row — no group_by, no dedup."""
        if invalid_df.is_empty():
            return []
        sort_col = '__source_row_id' if '__source_row_id' in invalid_df.columns else '__source_excel_row_number'
        export_cols = [
            c
            for c in invalid_df.columns
            if not str(c).startswith('__') or c in {
                '__source_row_id',
                '__source_excel_row_number',
                '__voucher_display',
                '__voucher_norm',
                '__sales_account_text',
                '__product_text',
                '__uploaded_unit_rate',
                '__unit_rate_raw',
                '__parsed_quantity',
                '__extracted_master_price',
                '__min_allowed_rate',
                '__max_allowed_rate',
                '__current_market_rate',
                '__rate_validation_source',
                '__validation_status',
                '__audit_status',
                '__audit_reason',
                '__invalid_product_mapping',
                '__invalid_product_pattern',
                '__invalid_rate_deviation',
                '__raw_excel_row_json',
                '__original_excel_sales_account',
                '__original_excel_product',
                '__original_excel_unit_rate',
                '__party_display',
            }
        ]
        slim = invalid_df.sort(sort_col).select(export_cols)
        return [self._record_from_row(row) for row in slim.to_dicts()]

    @staticmethod
    def _deviation_percent(uploaded: float | None, standard: float | None) -> float | None:
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
        if row.get('__invalid_product_mapping'):
            issues.append('INVALID_PRODUCT_MAPPING')
        if row.get('__invalid_product_pattern'):
            issues.append('INVALID_PRODUCT_PATTERN')
        if row.get('__invalid_rate_deviation'):
            issues.append('INVALID_RATE_DEVIATION')

        excel_row = int(row.get('__source_row_id') or row['__source_excel_row_number'])
        uploaded = row.get('__uploaded_unit_rate')
        standard = row.get('__extracted_master_price')
        market_rate = row.get('__current_market_rate')
        rate_diff = None
        if uploaded is not None and standard is not None:
            try:
                rate_diff = round(float(uploaded) - float(standard), 4)
            except (TypeError, ValueError):
                rate_diff = None

        return {
            'rowNumber': excel_row,
            'rowId': excel_row,
            'sourceExcelRowNumber': excel_row,
            'voucherNo': row.get('__voucher_display') or '',
            'voucherNorm': row.get('__voucher_norm') or '',
            'partyName': row.get('__party_display') or '',
            'originalExcelSalesAccount': row.get('__original_excel_sales_account') or '',
            'originalExcelProduct': row.get('__original_excel_product') or '',
            'originalExcelUnitRate': row.get('__original_excel_unit_rate') or '',
            'validationSalesAccount': row.get('__sales_account_text') or '',
            'validationProduct': row.get('__product_text') or '',
            'salesAccount': row.get('__sales_account_text') or '',
            'product': row.get('__product_text') or '',
            'unitRate': uploaded,
            'uploadedUnitRate': uploaded,
            'uploadedRate': uploaded,
            'masterStandardRate': standard,
            'standardRate': standard,
            'currentMarketRate': market_rate,
            'minAllowedRate': row.get('__min_allowed_rate'),
            'maxAllowedRate': row.get('__max_allowed_rate'),
            'deviationPercent': self._deviation_percent(uploaded, standard),
            'rateDifference': rate_diff,
            'rateValidationSource': row.get('__rate_validation_source'),
            'validationStatus': row.get('__validation_status'),
            'quantity': row.get('__parsed_quantity'),
            'parsedQuantity': row.get('__parsed_quantity'),
            'rawUnitRate': row.get('__unit_rate_raw'),
            'rawExcelRowJson': row.get('__raw_excel_row_json'),
            'auditStatus': row.get('__audit_status'),
            'auditReason': row.get('__audit_reason'),
            'issues': issues,
            'messages': _messages_for_issues(issues),
        }

    def _write_debug_exports(self, *, adjudicated_df: pl.DataFrame) -> dict[str, int]:
        _DEBUG_DIR.mkdir(parents=True, exist_ok=True)
        debug_cols = [
            '__source_row_id',
            '__source_excel_row_number',
            '__voucher_display',
            '__product_norm',
            '__sales_account_norm',
            '__detected_category',
            '__slab_family',
            '__extracted_master_price',
            '__min_allowed_rate',
            '__max_allowed_rate',
            '__mapping_valid',
            '__mapping_validation_result',
            '__rate_valid',
            '__rate_validation_result',
            '__final_issue',
            '__drop_reason',
            '__audit_status',
            '__audit_reason',
            '__invalid_product_mapping',
            '__invalid_product_pattern',
            '__invalid_rate_deviation',
            '__uploaded_unit_rate',
        ]
        export_cols = [c for c in debug_cols if c in adjudicated_df.columns] + [
            c
            for c in adjudicated_df.columns
            if c in ('voucher_no', 'sales_account', 'product', 'unit_rate', 'quantity')
        ]
        adjudicated_df.select(export_cols).write_csv(_DEBUG_DIR / 'sales_transaction_pipeline.csv')
        return write_sales_audit_workbook(
            adjudicated_df,
            output_path=_DEBUG_DIR / 'sales_audit_trace.xlsx',
        )

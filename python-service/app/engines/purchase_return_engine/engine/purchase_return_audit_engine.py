"""Purchase Return audit — validate via purchase ledger mode; compare to purchase averages."""

from __future__ import annotations

from time import perf_counter
from typing import Any

import polars as pl

from app.core.vectorized_validation_engine import LoadedValidationSheet
from app.engines.purchase_return_engine.engine.exception_report import (
    build_consolidated_exception_records,
    build_export_metadata,
    build_source_rows_by_product,
    summarize_return_validation_records,
)
from app.engines.purchase_return_engine.engine.header_normalization import (
    format_detection_log_label,
    normalize_purchase_return_dataframe,
    purchase_return_account_present,
)
from app.engines.purchase_return_engine.engine.purchase_return_average_engine import (
    HIGHER_PURCHASE_RETURN_RATE,
    INVALID_FREE_QUANTITY,
    INVALID_FREE_QUANTITY_MSG,
    INVALID_LEDGER_MAPPING,
    LEDGER_MAPPING_ISSUES,
    PRODUCT_NOT_FOUND_IN_PURCHASE,
    baseline_averages_from_stored_records,
    build_all_product_average_comparison_records,
    calculate_purchase_return_average_rates,
    compare_average_rates,
)
from app.engines.sales_engine.engine.vectorized_sales_engine import VectorizedSalesEngine
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError

_REQUIRED = frozenset({'voucher_no', 'product', 'unit_rate'})
_HEADER_CORE = frozenset({'voucher_no', 'product', 'unit_rate'})
_AVERAGE_COLUMNS = frozenset({'product', 'gross_amount', 'quantity'})

__all__ = [
    'HIGHER_PURCHASE_RETURN_RATE',
    'INVALID_FREE_QUANTITY',
    'INVALID_FREE_QUANTITY_MSG',
    'INVALID_LEDGER_MAPPING',
    'PurchaseReturnAuditEngine',
]


def _purchase_return_header_row_matches(labels: set[str]) -> bool:
    if not _HEADER_CORE <= labels:
        return False
    return purchase_return_account_present(labels)


class PurchaseReturnAuditEngine:
    """Validate purchase return rows via purchase ledger; compare against purchase averages."""

    def __init__(self) -> None:
        self.sales_engine = VectorizedSalesEngine()
        self._log = get_logger()

    def process(
        self,
        return_file_bytes: bytes,
        stored_purchase_averages: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        start = perf_counter()

        return_loaded = self._load_sheet(return_file_bytes)
        self._ensure_average_columns(return_loaded)

        return_validation = self.sales_engine.validate_loaded_sheet(return_loaded)
        return_validation.records = [
            self._map_return_validation_record(record)
            for record in return_validation.records
        ]

        purchase_averages = baseline_averages_from_stored_records(stored_purchase_averages or [])
        return_averages = calculate_purchase_return_average_rates(return_loaded, self.sales_engine)
        product_average_comparison_records = build_all_product_average_comparison_records(
            purchase_averages,
            return_averages,
        )
        rate_comparison = compare_average_rates(purchase_averages, return_averages)
        comparison_records = [row.to_record() for row in rate_comparison]
        source_columns = self.sales_engine.loader.user_columns(return_loaded.dataframe)
        display_headers = dict(return_loaded.column_display_headers or {})
        source_rows_by_product = self._build_source_rows_by_product(return_loaded)
        exception_records = build_consolidated_exception_records(
            return_validation.records,
            comparison_records,
            source_columns=source_columns,
            column_display_headers=display_headers,
            source_rows_by_product=source_rows_by_product,
        )

        validation_summary = summarize_return_validation_records(return_validation.records)

        total_ms = (perf_counter() - start) * 1000
        summary = {
            **return_validation.summary,
            **validation_summary,
            'purchaseProductCount': len(purchase_averages),
            'salesProductCount': len(purchase_averages),  # UI widgets reuse this key
            'returnProductCount': len(return_averages),
            'higherReturnRateProducts': sum(
                1 for row in rate_comparison if row.issue == HIGHER_PURCHASE_RETURN_RATE
            ),
            'missingPurchaseBaselineProducts': sum(
                1
                for row in product_average_comparison_records
                if PRODUCT_NOT_FOUND_IN_PURCHASE in (row.get('issues') or [])
            ),
            'missingSalesBaselineProducts': sum(
                1
                for row in product_average_comparison_records
                if PRODUCT_NOT_FOUND_IN_PURCHASE in (row.get('issues') or [])
            ),
            'productAverageComparisonCount': len(product_average_comparison_records),
            'rateComparisonViolations': len(comparison_records),
            'exceptionRowCount': len(exception_records),
            'processingMs': round(total_ms, 2),
            'purchaseAuditBaselineCount': len(purchase_averages),
            'salesAuditBaselineCount': len(purchase_averages),
        }

        export_column_labels, _export_header_map = build_export_metadata(
            source_columns,
            display_headers,
        )

        return {
            'success': True,
            'fileType': 'purchase_return',
            'totalRows': return_validation.total_rows,
            'errorRows': validation_summary['distinctInvalidRows'],
            'summary': summary,
            'validationIssues': return_validation.records,
            'rateComparisonRecords': comparison_records,
            'comparisonIssues': comparison_records,
            'productAverageComparisonRecords': product_average_comparison_records,
            'exceptionRecords': exception_records,
            'records': exception_records,
            'exportColumns': export_column_labels,
            'sourceColumns': source_columns,
            'columnDisplayHeaders': display_headers,
        }

    def _load_sheet(self, file_bytes: bytes) -> LoadedValidationSheet:
        label = 'Purchase return audit file'
        loaded = self.sales_engine.loader.load_sheet(
            file_bytes,
            row_matches=_purchase_return_header_row_matches,
            scan_limit=100,
        )
        display_headers = dict(loaded.column_display_headers or {})
        dataframe, display_headers, purchase_format = normalize_purchase_return_dataframe(
            loaded.dataframe,
            display_headers=display_headers,
        )
        format_label = format_detection_log_label(purchase_format)
        if format_label:
            self._log.info(
                f'[purchase_return] detected format={format_label} '
                f'header_row={loaded.header_row_index + 1}'
            )

        # Force purchase ledger mode (purchase_account → sales_account internal field).
        dataframe = self.sales_engine._canonicalize_upload_columns(dataframe)
        if self.sales_engine._ledger_mode == 'purchase':
            display_headers['sales_account'] = display_headers.get(
                'purchase_account',
                display_headers.get('sales_account', 'Purchase Return Account'),
            )

        data_columns = self.sales_engine.loader.user_columns(dataframe)
        missing = _REQUIRED - set(data_columns)
        # After canonicalize, account column is sales_account (purchase mode).
        account_ok = 'sales_account' in data_columns or 'purchase_account' in data_columns
        if missing or not account_ok:
            if not account_ok:
                missing = set(missing) | {'purchase_account'}
            header_excel = int(loaded.header_row_index) + 1
            raise SheetValidationError(
                f'{label}: missing required columns after header detection: '
                f'{", ".join(sorted(missing))}',
                code='MISSING_REQUIRED_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=sorted(c for c in data_columns if str(c).strip()),
                headerRowExcel=header_excel,
                expectedColumns=sorted(_REQUIRED | {'purchase_account'}),
                hints=[
                    'Provide Voucher No, Purchase Return Account (or Purchase Returns Account), '
                    'Product, and Unit Rate.',
                    'Optional: Purchase Voucher No, Quantity, Gross Amount, UOM, GST, Net Amount.',
                    'Both Purchase Return Excel formats are auto-detected.',
                ],
            )

        return LoadedValidationSheet(
            dataframe=dataframe,
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
            column_display_headers=display_headers,
        )

    @staticmethod
    def _ensure_average_columns(loaded: LoadedValidationSheet) -> None:
        data_columns = set(loaded.dataframe.columns)
        missing = _AVERAGE_COLUMNS - data_columns
        if missing:
            raise SheetValidationError(
                'Purchase return audit file: missing columns required for average rate comparison: '
                f'{", ".join(sorted(missing))}',
                code='MISSING_AVERAGE_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=sorted(c for c in data_columns if not c.startswith('__')),
                headerRowExcel=int(loaded.header_row_index) + 1,
                expectedColumns=sorted(_AVERAGE_COLUMNS),
                hints=[
                    'Product-wise average rate uses SUM(gross_amount) / SUM(quantity).',
                    'Ensure Gross Amount and Quantity columns exist in the workbook.',
                ],
            )

    def _build_source_rows_by_product(self, loaded: LoadedValidationSheet) -> dict[str, list[dict[str, Any]]]:
        columns = self.sales_engine.loader.user_columns(loaded.dataframe)
        display_headers = dict(loaded.column_display_headers or {})
        enriched = self.sales_engine._enrich_sales_dataframe(loaded.dataframe)
        if enriched.is_empty() or '__is_transaction_row' not in enriched.columns:
            return {}
        txn = enriched.filter(pl.col('__is_transaction_row').fill_null(False))
        rows = [dict(row) for row in txn.iter_rows(named=True)]
        return build_source_rows_by_product(rows, columns, display_headers)

    @staticmethod
    def _map_return_validation_record(record: dict[str, Any]) -> dict[str, Any]:
        issues = list(record.get('issues') or [])
        mapped_issues: list[str] = []
        mapped_messages = list(record.get('messages') or [])

        for code in issues:
            if code == 'INVALID_UNIT_RATE_RANGE':
                mapped_issues.append(INVALID_FREE_QUANTITY)
                mapped_messages = [INVALID_FREE_QUANTITY_MSG]
            elif code in LEDGER_MAPPING_ISSUES:
                mapped_issues.append(INVALID_LEDGER_MAPPING)
            else:
                mapped_issues.append(code)

        if not mapped_issues:
            return record

        updated = {**record, 'issues': mapped_issues}
        if mapped_messages:
            updated['messages'] = mapped_messages
        elif INVALID_LEDGER_MAPPING in mapped_issues and not record.get('messages'):
            updated['messages'] = ['Invalid purchase return ledger mapping.']
        return updated

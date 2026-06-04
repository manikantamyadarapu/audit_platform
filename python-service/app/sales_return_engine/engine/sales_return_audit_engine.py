from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any

import polars as pl

from app.engines.vectorized_validation_engine import LoadedValidationSheet
from app.sales_engine.engine.vectorized_sales_engine import (
    VectorizedSalesEngine,
    _strict_unsigned_number_expr,
)
from app.utils.sheet_validation_error import SheetValidationError

_REQUIRED = frozenset({'voucher_no', 'product', 'unit_rate'})
_HEADER_CORE = frozenset({'voucher_no', 'product', 'unit_rate'})
_AVERAGE_COLUMNS = frozenset({'product', 'gross_amount', 'quantity'})

HIGHER_SALES_RETURN_RATE = 'HIGHER_SALES_RETURN_RATE'
HIGHER_SALES_RETURN_RATE_MSG = (
    'Average sales return rate is higher than average sales rate.'
)
INVALID_FREE_QUANTITY = 'INVALID_FREE_QUANTITY'
INVALID_FREE_QUANTITY_MSG = 'Free quantity not allowed for this product.'


def _sales_or_return_header_row_matches(labels: set[str]) -> bool:
    if not _HEADER_CORE <= labels:
        return False
    return 'sales_account' in labels or 'sales_return_account' in labels


@dataclass(slots=True)
class ProductAverage:
    product_key: str
    product: str
    total_gross_amount: float
    total_quantity: float
    average_rate: float


@dataclass(slots=True)
class RateComparisonRow:
    product: str
    sales_total_gross_amount: float
    sales_total_quantity: float
    sales_average_rate: float
    return_total_gross_amount: float
    return_total_quantity: float
    return_average_rate: float
    difference: float
    issue: str
    message: str

    def to_record(self) -> dict[str, Any]:
        return {
            'product': self.product,
            'salesTotalGrossAmount': round(self.sales_total_gross_amount, 4),
            'salesTotalQuantity': round(self.sales_total_quantity, 4),
            'salesAverageRate': round(self.sales_average_rate, 4),
            'returnTotalGrossAmount': round(self.return_total_gross_amount, 4),
            'returnTotalQuantity': round(self.return_total_quantity, 4),
            'returnAverageRate': round(self.return_average_rate, 4),
            'difference': round(self.difference, 4),
            'issues': [self.issue],
            'messages': [self.message],
        }


class SalesReturnAuditEngine:
    """Validate sales return rows via sales engine; compare product-wise average rates."""

    def __init__(self) -> None:
        self.sales_engine = VectorizedSalesEngine()

    def process(self, sales_file_bytes: bytes, return_file_bytes: bytes) -> dict[str, Any]:
        start = perf_counter()

        sales_loaded = self._load_sheet(sales_file_bytes, label='Sales audit file')
        return_loaded = self._load_sheet(return_file_bytes, label='Sales return audit file', is_return=True)

        self._ensure_average_columns(sales_loaded, label='Sales audit file')
        self._ensure_average_columns(return_loaded, label='Sales return audit file')

        return_validation = self.sales_engine.validate_loaded_sheet(return_loaded)
        return_validation.records = [
            self._map_return_validation_record(record)
            for record in return_validation.records
        ]

        sales_averages = self._product_averages_from_loaded(sales_loaded)
        return_averages = self._product_averages_from_loaded(return_loaded)
        rate_comparison = self._compare_product_averages(sales_averages, return_averages)
        comparison_records = [row.to_record() for row in rate_comparison]

        return_error_rows = int(
            return_validation.summary.get('distinctInvalidRows')
            or return_validation.summary.get('errorRowsCount')
            or len(return_validation.records)
        )

        total_ms = (perf_counter() - start) * 1000
        summary = {
            **return_validation.summary,
            'returnValidationErrorRows': return_error_rows,
            'salesProductCount': len(sales_averages),
            'returnProductCount': len(return_averages),
            'higherReturnRateProducts': len(comparison_records),
            'rateComparisonViolations': len(comparison_records),
            'processingMs': round(total_ms, 2),
        }

        return {
            'success': True,
            'fileType': 'sales_return',
            'totalRows': return_validation.total_rows,
            'errorRows': return_error_rows + len(comparison_records),
            'summary': summary,
            'returnValidationRecords': return_validation.records,
            'rateComparisonRecords': comparison_records,
            'records': return_validation.records + comparison_records,
        }

    def _load_sheet(
        self,
        file_bytes: bytes,
        *,
        label: str,
        is_return: bool = False,
    ) -> LoadedValidationSheet:
        loaded = self.sales_engine.loader.load_sheet(
            file_bytes,
            row_matches=_sales_or_return_header_row_matches,
            scan_limit=100,
        )
        dataframe = self._canonicalize_columns(loaded.dataframe, is_return=is_return)
        data_columns = self.sales_engine.loader.user_columns(dataframe)
        missing = _REQUIRED - set(data_columns)
        if missing:
            header_excel = int(loaded.header_row_index) + 1
            raise SheetValidationError(
                f'{label}: missing required columns after header detection: {", ".join(sorted(missing))}',
                code='MISSING_REQUIRED_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=sorted(c for c in data_columns if str(c).strip()),
                headerRowExcel=header_excel,
                expectedColumns=sorted(_REQUIRED),
                hints=[
                    'Provide voucher_no, sales_account (or sales_return_account), product, and unit_rate.',
                    'Sales return audit reuses the same header layout as sales audit.',
                ],
            )
        return LoadedValidationSheet(
            dataframe=dataframe,
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
        )

    @staticmethod
    def _canonicalize_columns(dataframe: pl.DataFrame, *, is_return: bool) -> pl.DataFrame:
        renames: dict[str, str] = {}
        if 'sales_return_account' in dataframe.columns and 'sales_account' not in dataframe.columns:
            renames['sales_return_account'] = 'sales_account'
        if 'unitrate' in dataframe.columns and 'unit_rate' not in dataframe.columns:
            renames['unitrate'] = 'unit_rate'
        if 'rate' in dataframe.columns and 'unit_rate' not in dataframe.columns:
            renames['rate'] = 'unit_rate'
        if 'qty' in dataframe.columns and 'quantity' not in dataframe.columns:
            renames['qty'] = 'quantity'
        if 'gross_amt' in dataframe.columns and 'gross_amount' not in dataframe.columns:
            renames['gross_amt'] = 'gross_amount'
        if renames:
            dataframe = dataframe.rename(renames)

        if is_return and 'sales_account' in dataframe.columns:
            dataframe = dataframe.with_columns(
                pl.col('sales_account')
                .cast(pl.Utf8, strict=False)
                .fill_null('')
                .str.replace_all(r'(?i)sales\s+return', 'sales', literal=False)
                .str.replace_all(r'\s+', ' ')
                .str.strip_chars()
                .alias('sales_account')
            )
        return dataframe

    @staticmethod
    def _ensure_average_columns(loaded: LoadedValidationSheet, *, label: str) -> None:
        data_columns = set(loaded.dataframe.columns)
        missing = _AVERAGE_COLUMNS - data_columns
        if missing:
            raise SheetValidationError(
                f'{label}: missing columns required for average rate comparison: '
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

    def _product_averages_from_loaded(self, loaded: LoadedValidationSheet) -> dict[str, ProductAverage]:
        enriched = self.sales_engine._enrich_sales_dataframe(loaded.dataframe)
        txn_mask = (
            pl.col('__is_transaction_row').fill_null(False)
            & ~pl.col('__is_blank_row').fill_null(False)
            & ~pl.col('__is_repeated_header').fill_null(False)
        )
        txn = enriched.filter(txn_mask)
        if txn.is_empty():
            return {}

        parsed_gross = _strict_unsigned_number_expr(
            pl.col('gross_amount').cast(pl.Utf8, strict=False)
        ).alias('__parsed_gross_amount')

        grouped = (
            txn.with_columns(parsed_gross)
            .filter(
                pl.col('__parsed_gross_amount').is_not_null()
                & pl.col('__parsed_quantity').is_not_null()
                & (pl.col('__parsed_quantity') > 0)
                & pl.col('__product_norm').is_not_null()
                & (pl.col('__product_norm') != '')
            )
            .group_by('__product_norm')
            .agg(
                pl.col('__parsed_gross_amount').sum().alias('total_gross'),
                pl.col('__parsed_quantity').sum().alias('total_qty'),
                pl.col('__original_product').first().alias('product_display'),
            )
            .filter(pl.col('total_qty') > 0)
        )

        averages: dict[str, ProductAverage] = {}
        for row in grouped.to_dicts():
            product_key = str(row['__product_norm'])
            total_gross = float(row['total_gross'])
            total_qty = float(row['total_qty'])
            display = str(row.get('product_display') or product_key).strip() or product_key
            averages[product_key] = ProductAverage(
                product_key=product_key,
                product=display,
                total_gross_amount=total_gross,
                total_quantity=total_qty,
                average_rate=total_gross / total_qty,
            )
        return averages

    @staticmethod
    def _compare_product_averages(
        sales_averages: dict[str, ProductAverage],
        return_averages: dict[str, ProductAverage],
    ) -> list[RateComparisonRow]:
        violations: list[RateComparisonRow] = []
        for product_key, return_avg in return_averages.items():
            sales_avg = sales_averages.get(product_key)
            if sales_avg is None:
                continue
            if return_avg.average_rate <= sales_avg.average_rate:
                continue
            violations.append(
                RateComparisonRow(
                    product=return_avg.product,
                    sales_total_gross_amount=sales_avg.total_gross_amount,
                    sales_total_quantity=sales_avg.total_quantity,
                    sales_average_rate=sales_avg.average_rate,
                    return_total_gross_amount=return_avg.total_gross_amount,
                    return_total_quantity=return_avg.total_quantity,
                    return_average_rate=return_avg.average_rate,
                    difference=return_avg.average_rate - sales_avg.average_rate,
                    issue=HIGHER_SALES_RETURN_RATE,
                    message=HIGHER_SALES_RETURN_RATE_MSG,
                )
            )
        violations.sort(key=lambda row: row.product)
        return violations

    @staticmethod
    def _map_return_validation_record(record: dict[str, Any]) -> dict[str, Any]:
        issues = list(record.get('issues') or [])
        if 'INVALID_UNIT_RATE_RANGE' not in issues:
            return record
        mapped = [
            INVALID_FREE_QUANTITY if code == 'INVALID_UNIT_RATE_RANGE' else code
            for code in issues
        ]
        updated = {**record, 'issues': mapped}
        if any(code == INVALID_FREE_QUANTITY for code in mapped):
            updated['messages'] = [INVALID_FREE_QUANTITY_MSG]
        elif record.get('messages') == ['Unit rate must be between 0 and 1 for this product.']:
            updated['messages'] = [INVALID_FREE_QUANTITY_MSG]
        return updated

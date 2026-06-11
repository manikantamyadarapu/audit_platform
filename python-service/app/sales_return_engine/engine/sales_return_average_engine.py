"""Product-wise average rate calculation and sales vs sales-return comparison."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import polars as pl

from app.engines.vectorized_validation_engine import LoadedValidationSheet
from app.sales_engine.engine.vectorized_sales_engine import (
    VectorizedSalesEngine,
    _strict_unsigned_number_expr,
)

HIGHER_SALES_RETURN_RATE = 'HIGHER_SALES_RETURN_RATE'
HIGHER_SALES_RETURN_RATE_MSG = (
    'Average sales return rate is higher than average sales rate.'
)
INVALID_FREE_QUANTITY = 'INVALID_FREE_QUANTITY'
INVALID_FREE_QUANTITY_MSG = 'Free quantity not allowed for this product.'

LEDGER_MAPPING_ISSUES = frozenset({
    'INVALID_PRODUCT_MAPPING',
    'MISSING_PRODUCT_CATEGORY_FOR_VALIDATION',
    'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT',
})
INVALID_LEDGER_MAPPING = 'INVALID_LEDGER_MAPPING'


@dataclass(slots=True)
class ProductAverage:
    product_key: str
    product: str
    total_gross_amount: float
    total_quantity: float
    average_rate: float
    sales_account: str = ''


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


def _product_averages_by_exact_name(
    loaded: LoadedValidationSheet,
    sales_engine: VectorizedSalesEngine,
) -> dict[str, ProductAverage]:
    enriched = sales_engine._enrich_sales_dataframe(loaded.dataframe)
    txn_mask = (
        pl.col('__is_transaction_row').fill_null(False)
        & ~pl.col('__is_blank_row').fill_null(False)
        & ~pl.col('__is_repeated_header').fill_null(False)
    )
    txn = enriched.filter(txn_mask)
    if txn.is_empty():
        return {}

    product_col = (
        pl.col('__original_product').cast(pl.Utf8, strict=False).fill_null('')
        if '__original_product' in txn.columns
        else pl.col('product').cast(pl.Utf8, strict=False).fill_null('')
    )
    parsed_gross = _strict_unsigned_number_expr(
        pl.col('gross_amount').cast(pl.Utf8, strict=False)
    ).alias('__parsed_gross_amount')

    grouped = (
        txn.with_columns(
            parsed_gross,
            product_col.str.strip_chars().alias('__exact_product'),
        )
        .filter(
            pl.col('__parsed_gross_amount').is_not_null()
            & pl.col('__parsed_quantity').is_not_null()
            & (pl.col('__parsed_quantity') > 0)
            & pl.col('__exact_product').is_not_null()
            & (pl.col('__exact_product') != '')
        )
        .group_by('__exact_product')
        .agg(
            pl.col('__parsed_gross_amount').sum().alias('total_gross'),
            pl.col('__parsed_quantity').sum().alias('total_qty'),
            pl.col('__exact_product').first().alias('product_display'),
        )
        .filter(pl.col('total_qty') > 0)
    )

    averages: dict[str, ProductAverage] = {}
    for row in grouped.to_dicts():
        product_key = str(row['__exact_product'])
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


def sales_averages_from_stored_records(
    records: list[dict[str, Any]],
) -> dict[str, ProductAverage]:
    """Build lookup from persisted sales audit product averages (exact product names)."""
    averages: dict[str, ProductAverage] = {}
    for row in records:
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        total_gross = float(row.get('totalGrossAmount') or row.get('total_gross_amount') or 0)
        total_qty = float(row.get('totalQuantity') or row.get('total_quantity') or 0)
        if total_qty <= 0:
            continue
        average_rate = float(row.get('averageRate') or row.get('average_rate') or (total_gross / total_qty))
        sales_account = str(row.get('salesAccount') or row.get('sales_account') or '').strip()
        averages[product] = ProductAverage(
            product_key=product,
            product=product,
            total_gross_amount=total_gross,
            total_quantity=total_qty,
            average_rate=average_rate,
            sales_account=sales_account,
        )
    return averages


def calculate_sales_return_average_rates(
    loaded: LoadedValidationSheet,
    sales_engine: VectorizedSalesEngine,
) -> dict[str, ProductAverage]:
    """SUM(gross_amount) / SUM(quantity) per exact product name from the return file."""
    return _product_averages_by_exact_name(loaded, sales_engine)


def compare_average_rates(
    sales_averages: dict[str, ProductAverage],
    return_averages: dict[str, ProductAverage],
) -> list[RateComparisonRow]:
    """
    Compare exact product names only. Flag when return average rate exceeds sales average rate.
    Products without a stored sales baseline are skipped.
    """
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

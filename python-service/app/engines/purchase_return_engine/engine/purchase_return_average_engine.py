"""
Purchase Return average-rate comparison.

Reuses Sales Return average math (SUM(gross)/SUM(qty), baseline resolve, compare)
and remaps issue codes/messages to Purchase-specific identifiers.
"""

from __future__ import annotations

from typing import Any

from app.core.vectorized_validation_engine import LoadedValidationSheet
from app.engines.sales_engine.engine.vectorized_sales_engine import VectorizedSalesEngine
from app.engines.sales_return_engine.engine.sales_return_average_engine import (
    HIGHER_SALES_RETURN_RATE,
    INVALID_FREE_QUANTITY,
    INVALID_FREE_QUANTITY_MSG,
    INVALID_LEDGER_MAPPING,
    LEDGER_MAPPING_ISSUES,
    PRODUCT_NOT_FOUND_IN_SALES,
    ProductAverage,
    RateComparisonRow,
    build_all_product_average_comparison_records as _build_all_sales,
    calculate_sales_return_average_rates,
    compare_average_rates as _compare_sales,
    sales_averages_from_stored_records,
)

HIGHER_PURCHASE_RETURN_RATE = 'HIGHER_PURCHASE_RETURN_RATE'
HIGHER_PURCHASE_RETURN_RATE_MSG = 'Higher purchase return rate'
PRODUCT_NOT_FOUND_IN_PURCHASE = 'PRODUCT_NOT_FOUND_IN_PURCHASE'
PRODUCT_NOT_FOUND_IN_PURCHASE_MSG = 'Product not found in Purchase Audit file.'

# Re-export shared symbols used by the audit engine.
__all__ = [
    'HIGHER_PURCHASE_RETURN_RATE',
    'HIGHER_PURCHASE_RETURN_RATE_MSG',
    'PRODUCT_NOT_FOUND_IN_PURCHASE',
    'PRODUCT_NOT_FOUND_IN_PURCHASE_MSG',
    'INVALID_FREE_QUANTITY',
    'INVALID_FREE_QUANTITY_MSG',
    'INVALID_LEDGER_MAPPING',
    'LEDGER_MAPPING_ISSUES',
    'ProductAverage',
    'RateComparisonRow',
    'baseline_averages_from_stored_records',
    'calculate_purchase_return_average_rates',
    'compare_average_rates',
    'build_all_product_average_comparison_records',
]


def baseline_averages_from_stored_records(
    records: list[dict[str, Any]],
) -> dict[str, ProductAverage]:
    """Load purchase (or sales-shaped) product averages from persisted audit runs."""
    return sales_averages_from_stored_records(records)


def calculate_purchase_return_average_rates(
    loaded: LoadedValidationSheet,
    sales_engine: VectorizedSalesEngine,
) -> dict[str, ProductAverage]:
    return calculate_sales_return_average_rates(loaded, sales_engine)


def _remap_issue_list(issues: list[str] | None) -> list[str]:
    remapped: list[str] = []
    for code in issues or []:
        if code == HIGHER_SALES_RETURN_RATE:
            remapped.append(HIGHER_PURCHASE_RETURN_RATE)
        elif code == PRODUCT_NOT_FOUND_IN_SALES:
            remapped.append(PRODUCT_NOT_FOUND_IN_PURCHASE)
        else:
            remapped.append(code)
    return remapped


def _remap_message_list(messages: list[str] | None, issues: list[str]) -> list[str]:
    if HIGHER_PURCHASE_RETURN_RATE in issues:
        return [HIGHER_PURCHASE_RETURN_RATE_MSG]
    if PRODUCT_NOT_FOUND_IN_PURCHASE in issues:
        return [PRODUCT_NOT_FOUND_IN_PURCHASE_MSG]
    return list(messages or [])


def compare_average_rates(
    purchase_averages: dict[str, ProductAverage],
    return_averages: dict[str, ProductAverage],
) -> list[RateComparisonRow]:
    """Flag when purchase-return average rate exceeds purchase average rate."""
    rows = _compare_sales(purchase_averages, return_averages)
    remapped: list[RateComparisonRow] = []
    for row in rows:
        issue = (
            HIGHER_PURCHASE_RETURN_RATE
            if row.issue == HIGHER_SALES_RETURN_RATE
            else row.issue
        )
        message = (
            HIGHER_PURCHASE_RETURN_RATE_MSG
            if issue == HIGHER_PURCHASE_RETURN_RATE
            else row.message
        )
        remapped.append(
            RateComparisonRow(
                product=row.product,
                sales_total_gross_amount=row.sales_total_gross_amount,
                sales_total_quantity=row.sales_total_quantity,
                sales_average_rate=row.sales_average_rate,
                return_total_gross_amount=row.return_total_gross_amount,
                return_total_quantity=row.return_total_quantity,
                return_average_rate=row.return_average_rate,
                difference=row.difference,
                issue=issue,
                message=message,
            )
        )
    return remapped


def build_all_product_average_comparison_records(
    purchase_averages: dict[str, ProductAverage],
    return_averages: dict[str, ProductAverage],
) -> list[dict[str, Any]]:
    records = _build_all_sales(purchase_averages, return_averages)
    out: list[dict[str, Any]] = []
    for record in records:
        issues = _remap_issue_list(record.get('issues'))
        messages = _remap_message_list(record.get('messages'), issues)
        updated = {**record, 'issues': issues, 'messages': messages}
        out.append(updated)
    return out

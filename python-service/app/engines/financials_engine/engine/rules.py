"""Closing Stock calculation rules (framework stubs).

Business / Rule Book column calculations are intentionally not implemented yet.
These helpers define the extension points so Opening / Purchases / Receipts /
Issues / Sales / Average Rate / Closing / GP / Deviation can be plugged in later
without reshaping the audit pipeline.
"""

from __future__ import annotations

from typing import Any


class ClosingStockRulesNotImplementedError(NotImplementedError):
    """Raised when Closing Stock measure logic is invoked before it is wired."""


def apply_closing_stock_measures(
    *_args: Any,
    **_kwargs: Any,
) -> dict[str, Any]:
    """
    Placeholder for future Closing Stock qty/amount column population.

    Expected future inputs (not enforced yet):
    - products_by_category / layout_by_category from the product Rule Book
    - sales_by_category / purchases_by_category pivot totals
    - opening stock, receipts, issues (and other source ledgers)

    Returns:
        Structure that closing_stock_template / UI preview can consume.

    Raises:
        ClosingStockRulesNotImplementedError: always, until Rule Book calcs land.
    """
    raise ClosingStockRulesNotImplementedError(
        'Closing Stock measure calculations are not implemented yet. '
        'Template layout and product mapping are available; qty/amt columns stay blank.'
    )


def build_blank_measure_values() -> dict[str, None]:
    """Return empty measure placeholders for template/preview scaffolding."""
    return {
        'openingQty': None,
        'openingAmount': None,
        'purchasesQty': None,
        'purchasesAmount': None,
        'receiptsQty': None,
        'receiptsAmount': None,
        'issuesQty': None,
        'issuesAmount': None,
        'salesQty': None,
        'salesAmount': None,
        'averageRate': None,
        'closingQty': None,
        'closingAmount': None,
        'grossProfit': None,
        'deviation': None,
    }

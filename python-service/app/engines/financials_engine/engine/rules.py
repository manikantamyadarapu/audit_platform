"""Closing Stock measure helpers.

Opening / Purchases / Sales remain owned by the Rule Book join.
MR/DC location pivots are owned by ``mr_dc_pivots`` + ``mr_dc_closing_qty``.
Closing Stock valuation, Average Rate, COGS, and Gross Profit stay unimplemented here.
"""

from __future__ import annotations

from typing import Any


class ClosingStockRulesNotImplementedError(NotImplementedError):
    """Raised when unimplemented Closing Stock valuation measures are requested."""


def apply_closing_stock_measures(
    *_args: Any,
    **_kwargs: Any,
) -> dict[str, Any]:
    """
    Placeholder for Closing Stock *valuation* columns (Closing Qty/Amt, Avg Rate, GP).

    Receipts/Issues quantities from MR/DC are populated via ``mr_dc_pivots`` and
    ``mr_dc_closing_qty`` during the Rule Book join.
    """
    raise ClosingStockRulesNotImplementedError(
        'Closing Stock valuation measures (Closing Qty/Amt, Average Rate, Gross Profit, '
        'Deviation) are not implemented yet. MR/DC location pivots are handled by '
        'mr_dc_pivots + mr_dc_closing_qty.'
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

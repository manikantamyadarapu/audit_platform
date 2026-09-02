"""Closing Stock measure helpers for Receipts / Issues (and future columns).

Opening / Purchases / Sales remain owned by the Rule Book join.
Closing Stock valuation, Average Rate, COGS, and Gross Profit stay unimplemented.
"""

from __future__ import annotations

from typing import Any

from app.engines.financials_engine.engine.receipts_issues import (
    process_mr_dc_ledgers,
)


class ClosingStockRulesNotImplementedError(NotImplementedError):
    """Raised when unimplemented Closing Stock valuation measures are requested."""


def apply_closing_stock_measures(
    *_args: Any,
    **_kwargs: Any,
) -> dict[str, Any]:
    """
    Placeholder for Closing Stock *valuation* columns (Closing Qty/Amt, Avg Rate, GP).

    Receipts/Issues population is handled by ``receipts_issues`` + Rule Book join.
    """
    raise ClosingStockRulesNotImplementedError(
        'Closing Stock valuation measures (Closing Qty/Amt, Average Rate, Gross Profit, '
        'Deviation) are not implemented yet. Receipts/Issues from MR/DC are populated '
        'via the Receipts & Issues engine.'
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


def build_receipts_issues_from_ledgers(
    *,
    mr_rows: list[dict[str, Any]] | None = None,
    dc_rows: list[dict[str, Any]] | None = None,
    log: Any | None = None,
) -> dict[str, Any]:
    """Classify MR/DC ledgers into Receipts/Issues bucket pivots."""
    return process_mr_dc_ledgers(mr_rows=mr_rows, dc_rows=dc_rows, log=log)

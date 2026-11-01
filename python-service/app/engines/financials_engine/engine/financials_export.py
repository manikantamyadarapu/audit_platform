"""Build the workbook layout from the same pipeline as Financials preview."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    map_pivots_to_closing_stock_categories,
)
from app.engines.financials_engine.engine.receipt_amounts import (
    finalize_branch_financials,
    normalize_destination_branch,
)


def products_from_layout(
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]] | None,
) -> dict[str, list[str]]:
    products: dict[str, list[str]] = {}
    for category, rows in (layout_by_category or {}).items():
        names: list[str] = []
        for row in rows or ():
            if str(row.get('kind') or '') != 'product':
                continue
            label = str(row.get('label') or '').strip()
            if label:
                names.append(label)
        products[str(category)] = names
    return products


def prepare_branch_export_layout(
    *,
    destination: str,
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    opening_pivot: Sequence[Mapping[str, Any]] | None = None,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    source_average_rates: Any = None,
    receipt_rate_mappings: Any = None,
    source_issue_layouts: Any = None,
    source_opening_complete: Any = None,
    source_opening_pending: Any = None,
    source_transfer_lines: Any = None,
    destination_transfer_lines: Any = None,
    branch_kind: str = 'closing',
) -> dict[str, Any]:
    """Reuse process mapping, Phase 2 transfers, and receipt-amount formulas for export."""
    dest = normalize_destination_branch(destination) or destination
    layout = dict(layout_by_category or {})
    products = products_from_layout(layout)
    if not layout:
        if dest == 'jubileeHills' or branch_kind == 'jubilee':
            from app.engines.financials_engine.engine.jubilee_hills_placement import (
                apply_jubilee_hills_placement,
            )

            placed = apply_jubilee_hills_placement(
                {
                    'salesPivot': list(sales_pivot or []),
                    'purchasesPivot': list(purchases_pivot or []),
                    'openingPivot': list(opening_pivot or []),
                    'summary': {},
                },
                sales_pivot=list(sales_pivot or []),
                purchases_pivot=list(purchases_pivot or []),
                mr_pivots=mr_pivots,
                dc_pivots=dc_pivots,
                source_average_rates=source_average_rates,
                receipt_rate_mappings=receipt_rate_mappings,
            )
            layout = placed.get('layoutByCategory') or {}
            products = placed.get('productsByCategory') or products_from_layout(layout)
        else:
            mapped = map_pivots_to_closing_stock_categories(
                sales_pivot=list(sales_pivot or []),
                purchases_pivot=list(purchases_pivot or []),
                opening_pivot=list(opening_pivot or []),
                mr_pivots=mr_pivots,
                dc_pivots=dc_pivots,
                destination_branch=dest or None,
                source_average_rates=source_average_rates,
                receipt_rate_mappings=receipt_rate_mappings,
            )
            layout = mapped.get('layoutByCategory') or {}
            products = mapped.get('productsByCategory') or products_from_layout(layout)

    finalized = finalize_branch_financials(
        layout,
        destination=dest,
        source_average_rates=source_average_rates,
        receipt_rate_mappings=receipt_rate_mappings,
        source_issue_layouts=source_issue_layouts,
        source_opening_complete=source_opening_complete,
        source_opening_pending=source_opening_pending,
        source_transfer_lines=source_transfer_lines,
        destination_transfer_lines=destination_transfer_lines,
    )
    final_layout = finalized.get('layoutByCategory') or {}
    return {
        'productsByCategory': products or products_from_layout(final_layout),
        'layoutByCategory': final_layout,
        'receiptAmountReview': finalized.get('receiptAmountReview') or [],
        'transferReview': finalized.get('transferReview') or [],
        'productAverageRates': finalized.get('productAverageRates') or [],
        'destinationBranch': dest,
    }

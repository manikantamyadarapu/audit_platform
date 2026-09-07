"""Build Manual Opening Stock Quantity mapping queue after automatic matching.

Does not change automatic exact/fallback matching. Candidates come only from
dedicated previous-year product sheets (Closing Balance Quantity), never from
category summary tabs.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    build_product_location_index,
    load_closing_stock_product_rule_book,
    resolve_product_location,
)
from app.engines.financials_engine.engine.opening_stock import (
    _coerce_opening_measure,
    norm_opening_product_name,
)

_QTY_EPS = 1e-4


def _qty_present(value: Any) -> bool:
    qty = _coerce_opening_measure(value)
    if qty is None:
        return False
    return abs(float(qty)) > _QTY_EPS


def _claimed_previous_year_keys(report: Mapping[str, Any]) -> set[str]:
    claimed: set[str] = set()
    for row in list(report.get('matched') or []):
        for name in (
            row.get('sheetName'),
            row.get('product'),
            *((row.get('previousYearProducts') or []) if isinstance(row.get('previousYearProducts'), list) else ()),
        ):
            key = norm_opening_product_name(str(name or ''))
            if key:
                claimed.add(key)
    for row in list(report.get('fallbackMatched') or []):
        for name in row.get('previousYearProducts') or []:
            key = norm_opening_product_name(str(name or ''))
            if key:
                claimed.add(key)
        sheet = norm_opening_product_name(str(row.get('sheetName') or ''))
        if sheet:
            claimed.add(sheet)
    return claimed


def _pending_current_products(report: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Current-year products whose Opening Qty was not automatically mapped."""
    pending: list[dict[str, Any]] = []
    seen: set[str] = set()
    for bucket in (
        'previousYearMappingRequired',
        'quantityMismatch',
        'unmatched',
    ):
        for row in list(report.get(bucket) or []):
            product = str(row.get('product') or '').strip()
            key = norm_opening_product_name(product)
            if not product or not key or key in seen:
                continue
            if not _qty_present(row.get('openingQty')):
                continue
            seen.add(key)
            pending.append(dict(row))
    return pending


def build_manual_quantity_mapping_required(
    report: Mapping[str, Any],
    *,
    dedicated_product_sheets: Sequence[Mapping[str, Any]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Attach same-subcategory previous-year product-sheet candidates to unmatched
    current-year Opening Qty rows. No auto-selection or combination guessing.
    """
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    location_index = build_product_location_index(book)
    claimed = _claimed_previous_year_keys(report)

    candidates_by_sub: dict[tuple[str, str | None], list[dict[str, Any]]] = {}
    seen_candidate: set[tuple[str, str | None, str]] = set()
    for sheet in dedicated_product_sheets or ():
        if str(sheet.get('source') or 'product_sheet') != 'product_sheet':
            continue
        product = str(sheet.get('product') or sheet.get('sheetName') or '').strip()
        if not product:
            continue
        product_key = norm_opening_product_name(product)
        if not product_key or product_key in claimed:
            continue
        qty = _coerce_opening_measure(sheet.get('closingStockQty'))
        if qty is None:
            continue
        loc = resolve_product_location(product, index=location_index)
        if loc is None:
            continue
        category, subcategory = loc
        dedupe = (category, subcategory, product_key)
        if dedupe in seen_candidate:
            continue
        seen_candidate.add(dedupe)
        candidates_by_sub.setdefault((category, subcategory), []).append(
            {
                'product': product,
                'sheetName': str(sheet.get('sheetName') or product),
                'closingQty': qty,
            }
        )

    for rows in candidates_by_sub.values():
        rows.sort(key=lambda r: str(r.get('product') or '').casefold())

    queue: list[dict[str, Any]] = []
    for row in _pending_current_products(report):
        product = str(row.get('product') or '').strip()
        loc = resolve_product_location(product, index=location_index)
        if loc is None:
            continue
        category, subcategory = loc
        if not subcategory:
            continue
        queue.append(
            {
                'product': product,
                'openingQty': _coerce_opening_measure(row.get('openingQty')),
                'category': category,
                'subcategory': subcategory,
                'status': row.get('status'),
                'candidateProducts': list(candidates_by_sub.get((category, subcategory), ())),
            }
        )

    queue.sort(
        key=lambda r: (
            str(r.get('category') or ''),
            str(r.get('subcategory') or ''),
            str(r.get('product') or '').casefold(),
        )
    )
    return queue


def attach_manual_quantity_mapping(
    report: dict[str, Any],
    *,
    dedicated_product_sheets: Sequence[Mapping[str, Any]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    rows = build_manual_quantity_mapping_required(
        report,
        dedicated_product_sheets=dedicated_product_sheets,
        rule_book=rule_book,
    )
    report['manualQuantityMappingRequired'] = rows
    report['manualQuantityMappingRequiredCount'] = len(rows)
    return report

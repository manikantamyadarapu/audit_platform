"""Map MR/DC pivot quantities onto Closing Stock product rows.

Net is computed per branch from existing pivots. Pivots are never mutated.
Matching is normalized exact only (case-insensitive, trimmed, collapsed space).
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    _iter_rule_book_products,
    _norm_product,
)
from app.engines.financials_engine.engine.calculator import _round_amount

TRANSFER_QTY_KEYS: tuple[str, ...] = (
    'receiptsInternalQty',
    'receiptsJubileeHillsQty',
    'receiptsKokapetQty',
    'issuesInternalQty',
    'issuesBanjaraHillsQty',
    'issuesKokapetQty',
)

# location pivot key → (receipts qty field, issues qty field)
_LOCATION_NET_FIELDS: tuple[tuple[str, str, str], ...] = (
    ('jubileeHills', 'receiptsJubileeHillsQty', 'issuesBanjaraHillsQty'),
    ('kokapet', 'receiptsKokapetQty', 'issuesKokapetQty'),
    ('internalBasheerbagh', 'receiptsInternalQty', 'issuesInternalQty'),
)

_ZERO_EPS = 1e-12


def _exact_rule_book_lookup(rule_book: Mapping[str, Any]) -> dict[str, str]:
    """Map normalized product → Rule Book display name. First claim wins."""
    lookup: dict[str, str] = {}
    for _category, _subcategory, display_name in _iter_rule_book_products(rule_book):
        key = _norm_product(display_name)
        if key and key not in lookup:
            lookup[key] = display_name
    return lookup


def _qty_by_norm(rows: Sequence[Mapping[str, Any]] | None) -> dict[str, float]:
    totals: dict[str, float] = {}
    for row in rows or ():
        product_name = str(row.get('product') or '').strip()
        if not product_name:
            continue
        key = _norm_product(product_name)
        if not key:
            continue
        qty = float(row.get('sumOfQuantity') or 0)
        totals[key] = totals.get(key, 0.0) + qty
    return totals


def map_mr_dc_qty_to_rule_book(
    *,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None,
    rule_book: Mapping[str, Any],
) -> dict[str, dict[str, float]]:
    """
    Return Rule Book display name → quantity fields.

    For each branch independently:
      Net = SUM(MR Quantity) - SUM(DC Quantity) for the same normalized product.
      Net > 0 → Receipts Qty for that branch.
      Net < 0 → Issues Qty = ABS(Net) for that branch.
      Net = 0 → neither column.
    """
    lookup = _exact_rule_book_lookup(rule_book)
    mr_tree = mr_pivots or {}
    dc_tree = dc_pivots or {}
    by_display: dict[str, dict[str, float]] = {}

    for location, receipts_key, issues_key in _LOCATION_NET_FIELDS:
        mr_qty = _qty_by_norm(mr_tree.get(location))
        dc_qty = _qty_by_norm(dc_tree.get(location))
        for key in set(mr_qty) | set(dc_qty):
            net = mr_qty.get(key, 0.0) - dc_qty.get(key, 0.0)
            if abs(net) < _ZERO_EPS:
                continue
            display_name = lookup.get(key)
            if display_name is None:
                continue
            entry = by_display.setdefault(display_name, {})
            if net > 0:
                entry[receipts_key] = entry.get(receipts_key, 0.0) + net
            else:
                entry[issues_key] = entry.get(issues_key, 0.0) + abs(net)

    for entry in by_display.values():
        for field, value in list(entry.items()):
            entry[field] = _round_amount(value)
    return by_display

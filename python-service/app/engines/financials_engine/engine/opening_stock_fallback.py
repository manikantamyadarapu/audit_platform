"""Subcategory Opening Stock fallback — name-based candidates only; no qty combination guessing."""

from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    _build_rule_book_match_lookup,
    _iter_rule_book_products,
    _norm_product,
    _resolve_rule_book_display_name,
    build_product_location_index,
    load_closing_stock_product_rule_book,
    resolve_product_location,
)
from app.engines.financials_engine.engine.opening_stock import norm_opening_product_name
from app.utils.logger import get_logger

_QTY_EPS = 1e-4
_NON_ALNUM = re.compile(r'[^a-z0-9]+', re.IGNORECASE)
_ROSECUT_RC_NUMBER = re.compile(r'rc\s*(\d+)', re.IGNORECASE)
_ROSECUT_SUBCATEGORY_NORM = _norm_product('Diamonds Rosecut diamonds')

_CATEGORY_SHEET_MAP: dict[str, str] = {
    'Diamond': 'Dia',
    'Emerald': 'Eme',
    'Pearls': 'Prls',
    'Rubie': 'Rubi',
    'Precious and Semi Precious': 'Prec',
}

REASON_MANUAL_MAPPING_REQUIRED = 'Manual Mapping Required'


def _qty_equal(a: float | None, b: float | None) -> bool:
    if a is None or b is None:
        return False
    return abs(float(a) - float(b)) <= _QTY_EPS


def _norm_subcategory(name: str | None) -> str | None:
    if name is None:
        return None
    normalized = _norm_product(name)
    return normalized or None


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _prev_row_key(row: Mapping[str, Any]) -> str:
    return norm_opening_product_name(str(row.get('product') or ''))


def _candidate_payload(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        'product': str(row.get('product') or '').strip(),
        'closingStockQty': _coerce_float(row.get('closingStockQty')),
        'closingStockAmount': _coerce_float(row.get('closingStockAmount')),
        'sheetName': row.get('sheetName'),
    }


def _rule_book_names_in_subcategory(
    book: Mapping[str, Any],
    *,
    category: str,
    subcategory: str | None,
) -> set[str]:
    norm_sub = _norm_subcategory(subcategory)
    names: set[str] = set()
    for cat, sub, display in _iter_rule_book_products(book):
        if cat != category:
            continue
        if _norm_subcategory(sub) != norm_sub:
            continue
        names.add(display)
    return names


def _resolve_in_subcategory(
    product_name: str,
    *,
    lookup: Mapping[str, str],
    subcategory_names: set[str],
) -> str | None:
    resolved = _resolve_rule_book_display_name(product_name, lookup=lookup)
    if resolved and resolved in subcategory_names:
        return resolved
    return None


def _sum_prev_qty(rows: Sequence[Mapping[str, Any]]) -> float:
    return sum(_coerce_float(r.get('closingStockQty')) or 0.0 for r in rows)


def _sum_prev_amt(rows: Sequence[Mapping[str, Any]]) -> float:
    return sum(_coerce_float(r.get('closingStockAmount')) or 0.0 for r in rows)


def _is_base_name_variant(prev_name: str, base_display_name: str) -> bool:
    """Chakri ↔ Chakri a / Chakri b — trailing suffix only, not fuzzy."""
    norm_prev = _norm_product(prev_name)
    norm_base = _norm_product(base_display_name)
    if not norm_base or not norm_prev:
        return False
    if norm_prev == norm_base:
        return True
    return norm_prev.startswith(f'{norm_base} ')


def _match_base_name_variant_products(
    candidates: Sequence[Mapping[str, Any]],
    *,
    display_name: str,
    match_lookup: Mapping[str, str],
    subcategory_names: set[str],
    subcategory: str | None,
    claimed_keys: set[str],
) -> list[dict[str, Any]]:
    norm_sub = _norm_subcategory(subcategory)
    matched: list[dict[str, Any]] = []
    for row in candidates:
        key = _prev_row_key(row)
        if not key or key in claimed_keys:
            continue
        prev_name = str(row.get('product') or '').strip()
        if not prev_name or (norm_sub and _norm_product(prev_name) == norm_sub):
            continue
        if not _is_base_name_variant(prev_name, display_name):
            continue
        resolved = _resolve_in_subcategory(
            prev_name,
            lookup=match_lookup,
            subcategory_names=subcategory_names,
        )
        if resolved and resolved != display_name:
            continue
        matched.append(dict(row))
    return matched


def _is_rosecut_subcategory(subcategory: str | None) -> bool:
    return _norm_subcategory(subcategory) == _ROSECUT_SUBCATEGORY_NORM


def _extract_rosecut_number(product_name: str) -> str | None:
    match = _ROSECUT_RC_NUMBER.search(_norm_product(product_name))
    if not match:
        return None
    return match.group(1)


def _prev_name_matches_rosecut_number(prev_name: str, rc_number: str) -> bool:
    norm_prev = _norm_product(prev_name)
    alnum_prev = _NON_ALNUM.sub('', norm_prev)
    spaced_patterns = (
        rf'rc\s*{re.escape(rc_number)}(?:\D|$)',
        rf'rosecut\s*{re.escape(rc_number)}(?:\D|$)',
    )
    for pattern in spaced_patterns:
        if re.search(pattern, norm_prev, re.IGNORECASE):
            return True
    alnum_token = f'rc{rc_number}'
    idx = alnum_prev.find(alnum_token)
    while idx >= 0:
        after = idx + len(alnum_token)
        if after >= len(alnum_prev) or not alnum_prev[after].isdigit():
            return True
        idx = alnum_prev.find(alnum_token, idx + 1)
    return False


def _match_rosecut_previous_year_products(
    candidates: Sequence[Mapping[str, Any]],
    *,
    display_name: str,
    match_lookup: Mapping[str, str],
    subcategory_names: set[str],
    subcategory: str | None,
    claimed_keys: set[str],
) -> list[dict[str, Any]]:
    if not _is_rosecut_subcategory(subcategory):
        return []
    rc_number = _extract_rosecut_number(display_name)
    if not rc_number:
        return []

    norm_sub = _norm_subcategory(subcategory)
    matched: list[dict[str, Any]] = []
    for row in candidates:
        key = _prev_row_key(row)
        if not key or key in claimed_keys:
            continue
        prev_name = str(row.get('product') or '').strip()
        if not prev_name or (norm_sub and _norm_product(prev_name) == norm_sub):
            continue
        if not _prev_name_matches_rosecut_number(prev_name, rc_number):
            continue
        resolved = _resolve_in_subcategory(
            prev_name,
            lookup=match_lookup,
            subcategory_names=subcategory_names,
        )
        if resolved and resolved != display_name:
            continue
        matched.append(dict(row))
    return matched


def _list_subcategory_candidates(
    candidates: Sequence[Mapping[str, Any]],
    *,
    subcategory: str | None,
    claimed_keys: set[str],
) -> list[dict[str, Any]]:
    """All previous-year product rows in the subcategory (for Manual Mapping UI)."""
    norm_sub = _norm_subcategory(subcategory)
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in candidates:
        key = _prev_row_key(row)
        if not key or key in claimed_keys or key in seen:
            continue
        prev_name = str(row.get('product') or '').strip()
        if not prev_name:
            continue
        if norm_sub and _norm_product(prev_name) == norm_sub:
            continue
        seen.add(key)
        rows.append(_candidate_payload(row))
    return rows


def _identify_previous_year_products(
    candidates: Sequence[Mapping[str, Any]],
    *,
    display_name: str,
    match_lookup: Mapping[str, str],
    subcategory_names: set[str],
    subcategory: str | None,
    claimed_keys: set[str],
) -> list[dict[str, Any]]:
    """
    Name-based previous-year identification only (no orphan qty combination guessing).

    1. Rows that resolve to this Rule Book display name.
    2. Base-name variants (Chakri a / Chakri b).
    3. Rosecut RC-token rows (Di. RC 1 ↔ RC1) — Rosecut subcategory only.
    """
    norm_sub = _norm_subcategory(subcategory)
    primary: list[dict[str, Any]] = []

    for row in candidates:
        key = _prev_row_key(row)
        if not key or key in claimed_keys:
            continue
        prev_name = str(row.get('product') or '').strip()
        if not prev_name:
            continue
        if norm_sub and _norm_product(prev_name) == norm_sub:
            continue
        resolved = _resolve_in_subcategory(
            prev_name,
            lookup=match_lookup,
            subcategory_names=subcategory_names,
        )
        if resolved == display_name:
            primary.append(dict(row))

    if primary:
        return primary

    variant_matches = _match_base_name_variant_products(
        candidates,
        display_name=display_name,
        match_lookup=match_lookup,
        subcategory_names=subcategory_names,
        subcategory=subcategory,
        claimed_keys=claimed_keys,
    )
    if variant_matches:
        return variant_matches

    return _match_rosecut_previous_year_products(
        candidates,
        display_name=display_name,
        match_lookup=match_lookup,
        subcategory_names=subcategory_names,
        subcategory=subcategory,
        claimed_keys=claimed_keys,
    )


def _manual_mapping_result(
    *,
    category: str | None,
    subcategory: str | None,
    rule_book_product: str | None,
    sheet_name: str | None,
    candidate_products: list[dict[str, Any]],
    identified: Sequence[Mapping[str, Any]] | None = None,
    opening_qty: float | None = None,
) -> dict[str, Any]:
    identified_rows = list(identified or ())
    sum_qty = _sum_prev_qty(identified_rows) if identified_rows else None
    sum_amt = _sum_prev_amt(identified_rows) if identified_rows else None
    difference = None
    if opening_qty is not None and sum_qty is not None:
        difference = round(float(opening_qty) - float(sum_qty), 6)

    return {
        'status': 'manual_mapping_required',
        'reason': REASON_MANUAL_MAPPING_REQUIRED,
        'category': category,
        'subcategory': subcategory,
        'ruleBookProduct': rule_book_product,
        'sheetName': sheet_name,
        'candidateProducts': candidate_products,
        'previousYearProducts': [str(r.get('product') or '') for r in identified_rows],
        'previousClosingQty': round(sum_qty, 6) if sum_qty is not None else None,
        'previousClosingAmount': round(sum_amt, 4) if sum_amt is not None else None,
        'openingAmt': None,
        'difference': difference,
    }


def try_subcategory_fallback(
    *,
    product: str,
    opening_qty: float | None,
    subcategory_products: Mapping[tuple[str, str | None], Sequence[Mapping[str, Any]]]
    | None,
    sheet_products: Mapping[str, Sequence[Mapping[str, Any]]] | None,
    rule_book: Mapping[str, Any] | None = None,
    log: Any | None = None,
    claimed_prev_keys: set[str] | None = None,
) -> dict[str, Any] | None:
    """
    Fallback ONLY after exact previous-year name lookup fails.

    Auto-accepts Opening Amount only when a valid name-based previous-year set is
    found AND its Closing Qty exactly equals the Quantity file Opening Balance.
    Otherwise returns Manual Mapping Required with subcategory candidates — never
    invents combinations or maps amounts when quantities differ.
    """
    if not subcategory_products and not sheet_products:
        subcategory_products = {}
        sheet_products = {}

    logger = log or get_logger()
    claimed = claimed_prev_keys if claimed_prev_keys is not None else set()
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    location_index = build_product_location_index(book)
    match_lookup = _build_rule_book_match_lookup(book)

    display_name = _resolve_rule_book_display_name(product, lookup=match_lookup)
    location = resolve_product_location(product, index=location_index)
    if not display_name or not location:
        logger.warning(
            'Opening Stock fallback: Rule Book location not found product={}',
            product,
        )
        return _manual_mapping_result(
            category=None,
            subcategory=None,
            rule_book_product=display_name,
            sheet_name=None,
            candidate_products=[],
            opening_qty=opening_qty,
        )

    category, subcategory = location
    sheet_name = _CATEGORY_SHEET_MAP.get(category)
    if not sheet_name:
        return _manual_mapping_result(
            category=category,
            subcategory=subcategory,
            rule_book_product=display_name,
            sheet_name=None,
            candidate_products=[],
            opening_qty=opening_qty,
        )

    norm_sub = _norm_subcategory(subcategory)
    subcategory_names = _rule_book_names_in_subcategory(
        book,
        category=category,
        subcategory=subcategory,
    )
    candidates: list[Mapping[str, Any]] = []
    if norm_sub and subcategory_products:
        candidates = list(subcategory_products.get((sheet_name, norm_sub), ()))
    if not candidates and sheet_products:
        candidates = list(sheet_products.get(sheet_name, ()))

    candidate_products = _list_subcategory_candidates(
        candidates,
        subcategory=subcategory,
        claimed_keys=claimed,
    )

    if not candidates:
        logger.warning(
            'Opening Stock fallback: no previous-year subcategory rows product={} category={} subcategory={}',
            product,
            category,
            subcategory,
        )
        return _manual_mapping_result(
            category=category,
            subcategory=subcategory,
            rule_book_product=display_name,
            sheet_name=sheet_name,
            candidate_products=[],
            opening_qty=opening_qty,
        )

    matched_prev = _identify_previous_year_products(
        candidates,
        display_name=display_name,
        match_lookup=match_lookup,
        subcategory_names=subcategory_names,
        subcategory=subcategory,
        claimed_keys=claimed,
    )

    if not matched_prev:
        logger.warning(
            'Opening Stock fallback: previous-year products not identified product={} → Manual Mapping Required',
            product,
        )
        return _manual_mapping_result(
            category=category,
            subcategory=subcategory,
            rule_book_product=display_name,
            sheet_name=sheet_name,
            candidate_products=candidate_products,
            opening_qty=opening_qty,
        )

    sum_qty = _sum_prev_qty(matched_prev)
    sum_amt = _sum_prev_amt(matched_prev)
    qty_matches = _qty_equal(opening_qty, sum_qty)
    prev_product_names = [str(r.get('product') or '') for r in matched_prev]

    logger.info(
        'Opening Stock fallback: product={} → prev_products={} → prev_qty_sum={} → '
        'opening_qty={} → match={} → prev_amount={}',
        product,
        prev_product_names,
        round(sum_qty, 6),
        opening_qty,
        'yes' if qty_matches else 'no',
        round(sum_amt, 4),
    )

    if not qty_matches:
        # Never auto-map amount when qty differs — user must resolve manually.
        return _manual_mapping_result(
            category=category,
            subcategory=subcategory,
            rule_book_product=display_name,
            sheet_name=sheet_name,
            candidate_products=candidate_products,
            identified=matched_prev,
            opening_qty=opening_qty,
        )

    for row in matched_prev:
        key = _prev_row_key(row)
        if key:
            claimed.add(key)

    return {
        'status': 'matched_fallback',
        'reason': 'matched_via_subcategory_fallback',
        'category': category,
        'subcategory': subcategory,
        'ruleBookProduct': display_name,
        'sheetName': sheet_name,
        'previousYearProducts': prev_product_names,
        'previousClosingQty': round(sum_qty, 6),
        'previousClosingAmount': round(sum_amt, 4),
        'candidateProducts': candidate_products,
        'openingAmt': sum_amt,
    }

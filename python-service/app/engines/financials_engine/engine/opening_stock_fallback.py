"""Rule Book subcategory fallback for Opening Stock (unmatched products only)."""

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

# Closing Stock category sheet → previous-year workbook tab (Eximp layout).
_CATEGORY_SHEET_MAP: dict[str, str] = {
    'Diamond': 'Dia',
    'Emerald': 'Eme',
    'Pearls': 'Prls',
    'Rubie': 'Rubi',
    'Precious and Semi Precious': 'Prec',
}

REASON_QUANTITY_MISMATCH = 'Quantity Mismatch'
REASON_PREVIOUS_YEAR_MAPPING_REQUIRED = 'Previous Year Mapping Required'


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


def _is_base_name_variant(prev_name: str, base_display_name: str) -> bool:
    """
    True when prev_name is the same product with a suffix variant.

    Chakri ↔ Chakri a / Chakri b; Polki ↔ Polki x. Requires a word boundary after
    the base name (trailing space + suffix), not a longer unrelated name.
    """
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
    """
    Previous-year rows whose names extend the Rule Book product (Chakri a + Chakri b → Chakri).

    Applies in any subcategory after primary Rule Book name matching fails.
    """
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
    """Extract trailing RC number from names like Di. RC 1 → '1'."""
    match = _ROSECUT_RC_NUMBER.search(_norm_product(product_name))
    if not match:
        return None
    return match.group(1)


def _is_rosecut_rule_book_product(display_name: str) -> bool:
    return _extract_rosecut_number(display_name) is not None


def _prev_name_matches_rosecut_number(prev_name: str, rc_number: str) -> bool:
    """
    True when a previous-year Rosecut row name contains RC<number> as a token.

    Di. RC 1 ↔ RC1 / RC 1; must not match RC 10 or RC 13 when looking for RC 1.
    """
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
    """Rosecut-only: map Di. RC N to previous-year rows containing RC N / RCN tokens."""
    if not _is_rosecut_subcategory(subcategory):
        return []

    rc_number = _extract_rosecut_number(display_name)
    if not rc_number or not _is_rosecut_rule_book_product(display_name):
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


def _find_unique_qty_subset(
    rows: Sequence[Mapping[str, Any]],
    target_qty: float | None,
    *,
    exclude_keys: set[str] | None = None,
) -> list[dict[str, Any]] | None:
    """
    Return the unique subset of rows whose Closing Qty sums to target_qty.

    Returns None when zero or more than one subset matches.
    """
    if target_qty is None:
        return None

    excluded = exclude_keys or set()
    available = [
        dict(row)
        for row in rows
        if _prev_row_key(row) and _prev_row_key(row) not in excluded
    ]
    if not available:
        return None

    matches: list[list[dict[str, Any]]] = []

    def search(index: int, chosen: list[dict[str, Any]], qty_sum: float) -> None:
        if _qty_equal(qty_sum, target_qty):
            matches.append(list(chosen))
            return
        if index >= len(available) or qty_sum > float(target_qty) + _QTY_EPS:
            return
        if len(matches) > 1:
            return
        row = available[index]
        row_qty = _coerce_float(row.get('closingStockQty')) or 0.0
        search(index + 1, chosen, qty_sum)
        search(index + 1, chosen + [row], qty_sum + row_qty)

    search(0, [], 0.0)
    if len(matches) == 1:
        return matches[0]
    return None


def _identify_previous_year_products(
    candidates: Sequence[Mapping[str, Any]],
    *,
    display_name: str,
    opening_qty: float | None,
    match_lookup: Mapping[str, str],
    subcategory_names: set[str],
    subcategory: str | None,
    claimed_keys: set[str],
) -> list[dict[str, Any]]:
    """
    Previous-year rows for one current Rule Book product.

    1. Rows that resolve to this Rule Book display name (e.g. FP1 + FP 1 → Flat polki FP 1).
    2. Rows whose names extend the base product (e.g. Chakri a + Chakri b → Chakri).
    3. Rosecut RC-token rows (Di. RC 1 ↔ RC1) — Rosecut subcategory only.
    4. Otherwise, unclaimed orphan rows whose Closing Qty subset equals Opening Balance.
    """
    norm_sub = _norm_subcategory(subcategory)
    primary: list[dict[str, Any]] = []
    orphans: list[dict[str, Any]] = []

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
        elif resolved is None:
            orphans.append(dict(row))

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

    rosecut_matches = _match_rosecut_previous_year_products(
        candidates,
        display_name=display_name,
        match_lookup=match_lookup,
        subcategory_names=subcategory_names,
        subcategory=subcategory,
        claimed_keys=claimed_keys,
    )
    if rosecut_matches:
        return rosecut_matches

    subset = _find_unique_qty_subset(orphans, opening_qty, exclude_keys=claimed_keys)
    if subset is not None:
        return subset

    # Single unmatched product in subcategory: all orphans must sum to opening qty.
    unclaimed_orphans = [row for row in orphans if _prev_row_key(row) not in claimed_keys]
    if unclaimed_orphans and _qty_equal(_sum_prev_qty(unclaimed_orphans), opening_qty):
        return unclaimed_orphans

    return []


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
    Fallback ONLY for products not resolved by exact previous-year name lookup.

    Uses Rule Book category/subcategory, identifies previous-year Closing stock rows
    (by Rule Book name or orphan qty reconciliation), and validates qty against Opening Balance.
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
        return {
            'status': 'previous_year_mapping_required',
            'reason': REASON_PREVIOUS_YEAR_MAPPING_REQUIRED,
            'ruleBookProduct': display_name,
        }

    category, subcategory = location
    sheet_name = _CATEGORY_SHEET_MAP.get(category)
    if not sheet_name:
        logger.warning(
            'Opening Stock fallback: no previous-year sheet for category={} product={}',
            category,
            product,
        )
        return {
            'status': 'previous_year_mapping_required',
            'reason': REASON_PREVIOUS_YEAR_MAPPING_REQUIRED,
            'category': category,
            'subcategory': subcategory,
            'ruleBookProduct': display_name,
        }

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

    if not candidates:
        logger.warning(
            'Opening Stock fallback: no previous-year subcategory rows product={} category={} subcategory={} sheet={}',
            product,
            category,
            subcategory,
            sheet_name,
        )
        return {
            'status': 'previous_year_mapping_required',
            'reason': REASON_PREVIOUS_YEAR_MAPPING_REQUIRED,
            'category': category,
            'subcategory': subcategory,
            'ruleBookProduct': display_name,
            'sheetName': sheet_name,
        }

    matched_prev = _identify_previous_year_products(
        candidates,
        display_name=display_name,
        opening_qty=opening_qty,
        match_lookup=match_lookup,
        subcategory_names=subcategory_names,
        subcategory=subcategory,
        claimed_keys=claimed,
    )

    prev_product_names = [str(r.get('product') or '') for r in matched_prev]

    if not matched_prev:
        logger.warning(
            'Opening Stock fallback: previous-year products not identified product={} rule_book={} subcategory={}',
            product,
            display_name,
            subcategory,
        )
        return {
            'status': 'previous_year_mapping_required',
            'reason': REASON_PREVIOUS_YEAR_MAPPING_REQUIRED,
            'category': category,
            'subcategory': subcategory,
            'ruleBookProduct': display_name,
            'sheetName': sheet_name,
        }

    sum_qty = _sum_prev_qty(matched_prev)
    sum_amt = sum(_coerce_float(r.get('closingStockAmount')) or 0.0 for r in matched_prev)
    qty_matches = _qty_equal(opening_qty, sum_qty)

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

    base = {
        'category': category,
        'subcategory': subcategory,
        'ruleBookProduct': display_name,
        'sheetName': sheet_name,
        'previousYearProducts': prev_product_names,
        'previousClosingQty': round(sum_qty, 6),
        'previousClosingAmount': round(sum_amt, 4),
    }

    if not qty_matches:
        return {
            **base,
            'status': 'quantity_mismatch',
            'reason': REASON_QUANTITY_MISMATCH,
            'openingAmt': None,
            'difference': round((opening_qty or 0) - sum_qty, 6),
        }

    for row in matched_prev:
        key = _prev_row_key(row)
        if key:
            claimed.add(key)

    return {
        **base,
        'status': 'matched_fallback',
        'reason': 'matched_via_subcategory_fallback',
        'openingAmt': sum_amt,
    }

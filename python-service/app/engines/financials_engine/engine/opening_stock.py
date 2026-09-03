"""Opening Stock mapping: Quantity file qty + previous-year Closing Stock amounts."""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Mapping, Sequence

from app.utils.logger import get_logger

_UNICODE_WS = re.compile(
    r'[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+',
    re.UNICODE,
)
_NON_ALNUM = re.compile(r'[^a-z0-9]+', re.IGNORECASE)

# Leading category words used in Quantity file but omitted on Closing Stock sheets.
_CATEGORY_PREFIXES = (
    'emeralds ',
    'emerald ',
    'rubies ',
    'ruby ',
    'pearls ',
    'pearl ',
    'diamonds ',
    'diamond ',
    'semi precious ',
    'semiprecious ',
    'precious ',
    'synthetic ',
    'synthetics ',
    'sythetic ',
    'sythetics ',
    'precious stones ',
)


def norm_opening_product_name(name: str) -> str:
    """Case-insensitive, trim, collapse invisible/extra whitespace. No fuzzy matching."""
    text = unicodedata.normalize('NFKC', str(name or ''))
    text = _UNICODE_WS.sub(' ', text).strip().casefold()
    return ' '.join(text.split())


def alnum_opening_product_key(name: str) -> str:
    """Punctuation/spacing-insensitive key (Di. Beads ↔ Di Beads)."""
    return _NON_ALNUM.sub('', norm_opening_product_name(name))


def _strip_category_prefix(norm_name: str) -> str:
    for prefix in _CATEGORY_PREFIXES:
        if norm_name.startswith(prefix):
            return norm_name[len(prefix) :].strip()
    return norm_name


def opening_sku_key(name: str) -> str:
    """
    Trailing product code only (JSY 300 / Sythetic JSY 300 → jsy300).

    Used when the category word is misspelled or missing. Not fuzzy matching.
    """
    tokens = norm_opening_product_name(name).replace('.', ' ').split()
    cleaned = [_NON_ALNUM.sub('', t) for t in tokens]
    cleaned = [t for t in cleaned if t]
    if not cleaned:
        return ''
    digit_idx = None
    for i in range(len(cleaned) - 1, -1, -1):
        if any(ch.isdigit() for ch in cleaned[i]):
            digit_idx = i
            break
    if digit_idx is None:
        return ''
    start = digit_idx
    if start > 0 and cleaned[start - 1].isalpha():
        start -= 1
    return ''.join(cleaned[start:])


def product_sheet_lookup_keys(product: str) -> list[str]:
    """
    Deterministic lookup keys for Quantity ↔ previous-year Closing Stock product rows.

    Exact normalized name, alphanumeric form, and category-prefix-stripped variants.
    Not fuzzy matching.
    """
    name = str(product or '').strip()
    keys: list[str] = []
    seen: set[str] = set()

    def add(key: str) -> None:
        if key and key not in seen:
            seen.add(key)
            keys.append(key)

    primary = norm_opening_product_name(name)
    add(primary)
    add(alnum_opening_product_key(name))

    stripped = _strip_category_prefix(primary)
    if stripped != primary:
        add(stripped)
        add(alnum_opening_product_key(stripped))

    truncated = name[:31]
    add(norm_opening_product_name(truncated))
    add(alnum_opening_product_key(truncated))
    return keys


def _lookup_product_sheet(
    product: str,
    sheet_index: Mapping[str, Mapping[str, Any]],
) -> Mapping[str, Any] | None:
    for key in product_sheet_lookup_keys(product):
        entry = sheet_index.get(key)
        if entry is not None:
            return entry
    return None


def _coerce_opening_measure(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def build_opening_measures_for_layout(
    opening_pivot: Sequence[Mapping[str, Any]] | None,
    layout_product_names: Sequence[str],
) -> tuple[dict[str, dict[str, float | None]], list[dict[str, Any]]]:
    """
    Map Opening pivot rows onto Closing Stock layout labels by product name keys only.

    Does NOT use the Rule Book. Each layout product claims the first pivot row whose
    lookup keys intersect. Unique trailing SKU (JSY 300) is used only when it belongs
    to exactly one layout product, so a Quantity-file typo like Sythetic JSY 300
    still fills Synthetic JSY 300.
    """
    sku_owners: dict[str, list[str]] = {}
    for layout_name in layout_product_names:
        display = str(layout_name or '').strip()
        sku = opening_sku_key(display)
        if sku:
            sku_owners.setdefault(sku, []).append(display)
    unique_skus = {sku for sku, owners in sku_owners.items() if len(owners) == 1}

    def _keys_for(name: str) -> list[str]:
        keys = product_sheet_lookup_keys(name)
        sku = opening_sku_key(name)
        if sku and sku in unique_skus and sku not in keys:
            keys.append(sku)
        return keys

    pivot_index: dict[str, dict[str, float | None]] = {}
    pivot_products: list[tuple[str, list[str]]] = []

    for row in opening_pivot or ():
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        measures = {
            'sumOfQuantity': _coerce_opening_measure(
                row.get('sumOfQuantity') if row.get('sumOfQuantity') is not None else row.get('openingQty')
            ),
            'sumOfGross': _coerce_opening_measure(
                row.get('sumOfGross') if row.get('sumOfGross') is not None else row.get('openingAmt')
            ),
        }
        alias_names = [product]
        rule_book_product = str(row.get('ruleBookProduct') or '').strip()
        if rule_book_product and rule_book_product not in alias_names:
            alias_names.append(rule_book_product)
        keys: list[str] = []
        for alias in alias_names:
            for key in _keys_for(alias):
                if key not in keys:
                    keys.append(key)
        pivot_products.append((product, keys))
        for key in keys:
            if key not in pivot_index:
                pivot_index[key] = measures

    by_display: dict[str, dict[str, float | None]] = {}
    claimed_pivot_keys: set[str] = set()

    for layout_name in layout_product_names:
        display = str(layout_name or '').strip()
        if not display:
            continue
        for key in _keys_for(display):
            if key in pivot_index:
                by_display[display] = pivot_index[key]
                claimed_pivot_keys.add(key)
                break

    unmapped_rows: list[dict[str, Any]] = []
    for product, keys in pivot_products:
        if any(key in claimed_pivot_keys for key in keys):
            continue
        unmapped_rows.append(
            {
                'product': product,
                'sumOfQuantity': pivot_index.get(keys[0], {}).get('sumOfQuantity') if keys else None,
                'sumOfGross': pivot_index.get(keys[0], {}).get('sumOfGross') if keys else None,
            }
        )

    return by_display, unmapped_rows


def apply_fallback_opening_to_layout(
    by_display: dict[str, dict[str, float | None]],
    opening_pivot: Sequence[Mapping[str, Any]] | None,
    *,
    rule_book: Mapping[str, Any],
    unmapped_rows: list[dict[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, float | None]], list[dict[str, Any]]]:
    """
    Write fallback-matched Opening Stock onto Closing Stock layout rows.

    Uses ruleBookProduct + category/subcategory from the fallback result so renamed/
    combined products reach the correct Rule Book row even when name-key matching fails.
    Does not touch exact-name matched rows (status != matched_fallback).
    """
    from app.engines.financials_engine.config.product_rule_book import (
        _iter_rule_book_products,
        _norm_product,
    )

    display_locations: dict[str, tuple[str, str | None]] = {}
    for category, subcategory, display in _iter_rule_book_products(rule_book):
        display_locations[display] = (category, subcategory)

    def _norm_subcategory(name: str | None) -> str | None:
        if name is None:
            return None
        normalized = _norm_product(name)
        return normalized or None

    fallback_qty_names: set[str] = set()
    for row in opening_pivot or ():
        if row.get('status') != 'matched_fallback':
            continue

        target = str(row.get('ruleBookProduct') or '').strip()
        if not target or target not in display_locations:
            continue

        loc_category, loc_subcategory = display_locations[target]
        row_category = row.get('category')
        row_subcategory = row.get('subcategory')
        if row_category and row_category != loc_category:
            continue
        if row_subcategory is not None and _norm_subcategory(row_subcategory) != _norm_subcategory(
            loc_subcategory
        ):
            continue

        qty = _coerce_opening_measure(
            row.get('sumOfQuantity') if row.get('sumOfQuantity') is not None else row.get('openingQty')
        )
        amt = _coerce_opening_measure(
            row.get('sumOfGross') if row.get('sumOfGross') is not None else row.get('openingAmt')
        )
        if qty is None and amt is None:
            continue

        by_display[target] = {
            'sumOfQuantity': qty,
            'sumOfGross': amt,
        }
        fallback_qty_names.add(str(row.get('product') or '').strip())

    if unmapped_rows is not None and fallback_qty_names:
        filtered = [
            row
            for row in unmapped_rows
            if str(row.get('product') or '').strip() not in fallback_qty_names
        ]
        return by_display, filtered

    return by_display, unmapped_rows or []


def map_opening_stock_from_product_sheets(
    *,
    quantity_rows: Sequence[Mapping[str, Any]],
    previous_year_sheets: Mapping[str, Mapping[str, Any]],
    subcategory_products: Mapping[tuple[str, str | None], Sequence[Mapping[str, Any]]]
    | None = None,
    sheet_products: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
    log: Any | None = None,
) -> dict[str, Any]:
    """
    Build Opening Stock from the Quantity file + previous-year Closing Stock product rows.

    - Opening Qty = Quantity file Opening Balance (authority).
    - Opening Amount = previous-year Closing Balance Amount for that product (exact name first).
    - Unmatched products may resolve via Rule Book subcategory fallback (renamed/combined).
    - Missing product or Closing Amt → amount blank, logged with product + reason.
    """
    logger = log or get_logger()
    matched: list[dict[str, Any]] = []
    fallback_matched: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []
    manual_mapping_required: list[dict[str, Any]] = []
    validated_opening: list[dict[str, Any]] = []

    seen_keys: set[str] = set()
    claimed_prev_keys: set[str] = set()

    def _record_unmatched(
        entry_base: dict[str, Any],
        *,
        reason: str,
        sheet_name: str | None,
        primary_reason: str,
    ) -> None:
        unmatched.append(
            {
                **entry_base,
                'openingAmt': None,
                'status': 'unmatched',
                'reason': reason,
                'sheetName': sheet_name,
            }
        )
        validated_opening.append(
            {
                'product': entry_base['product'],
                'openingQty': entry_base.get('openingQty'),
                'openingAmt': None,
                'status': 'unmatched',
                'reason': reason,
                'sheetName': sheet_name,
            }
        )
        logger.warning(
            'Opening Stock unmatched: product={} sheet={} reason={}',
            entry_base['product'],
            sheet_name,
            primary_reason,
        )

    def _apply_fallback(entry_base: dict[str, Any], *, primary_reason: str) -> bool:
        """Run subcategory fallback after exact-name miss. Returns True if handled."""
        from app.engines.financials_engine.engine.opening_stock_fallback import (
            try_subcategory_fallback,
        )

        fallback = try_subcategory_fallback(
            product=str(entry_base['product']),
            opening_qty=entry_base.get('openingQty'),
            subcategory_products=subcategory_products,
            sheet_products=sheet_products,
            rule_book=rule_book,
            log=logger,
            claimed_prev_keys=claimed_prev_keys,
        )
        if fallback is None:
            return False

        status = fallback.get('status')
        sheet_name = fallback.get('sheetName')
        common = {
            **entry_base,
            'sheetName': sheet_name,
            'category': fallback.get('category'),
            'subcategory': fallback.get('subcategory'),
            'ruleBookProduct': fallback.get('ruleBookProduct'),
            'previousYearProducts': fallback.get('previousYearProducts'),
            'previousClosingQty': fallback.get('previousClosingQty'),
            'previousClosingAmount': fallback.get('previousClosingAmount'),
            'candidateProducts': fallback.get('candidateProducts') or [],
            'primaryReason': primary_reason,
        }

        if status == 'matched_fallback':
            row = {
                **common,
                'openingAmt': fallback.get('openingAmt'),
                'status': 'matched_fallback',
                'reason': fallback.get('reason'),
            }
            fallback_matched.append(row)
            validated_opening.append(
                {
                    'product': entry_base['product'],
                    'openingQty': entry_base.get('openingQty'),
                    'openingAmt': fallback.get('openingAmt'),
                    'status': 'matched_fallback',
                    'reason': fallback.get('reason'),
                    'sheetName': sheet_name,
                    'ruleBookProduct': fallback.get('ruleBookProduct'),
                    'category': fallback.get('category'),
                    'subcategory': fallback.get('subcategory'),
                    'previousYearProducts': fallback.get('previousYearProducts'),
                }
            )
            return True

        if status == 'manual_mapping_required':
            row = {
                **common,
                'openingAmt': None,
                'status': 'manual_mapping_required',
                'reason': fallback.get('reason') or 'Manual Mapping Required',
                'difference': fallback.get('difference'),
            }
            manual_mapping_required.append(row)
            validated_opening.append(
                {
                    'product': entry_base['product'],
                    'openingQty': entry_base.get('openingQty'),
                    'openingAmt': None,
                    'status': 'manual_mapping_required',
                    'reason': fallback.get('reason') or 'Manual Mapping Required',
                    'sheetName': sheet_name,
                    'ruleBookProduct': fallback.get('ruleBookProduct'),
                    'category': fallback.get('category'),
                    'subcategory': fallback.get('subcategory'),
                    'previousYearProducts': fallback.get('previousYearProducts'),
                    'previousClosingQty': fallback.get('previousClosingQty'),
                    'candidateProducts': fallback.get('candidateProducts') or [],
                    'difference': fallback.get('difference'),
                }
            )
            return True

        return False

    for qty_row in quantity_rows:
        product = str(qty_row.get('product') or '').strip()
        key = norm_opening_product_name(product)
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)

        opening_qty = qty_row.get('openingBalance')
        opening_qty_f = _coerce_opening_measure(opening_qty)

        sheet = _lookup_product_sheet(product, previous_year_sheets)
        entry_base = {
            'product': product,
            'openingQty': opening_qty_f,
            'sku': qty_row.get('sku'),
        }

        if sheet is None:
            if _apply_fallback(entry_base, primary_reason='product_sheet_not_found'):
                continue
            _record_unmatched(
                entry_base,
                reason='product_sheet_not_found',
                sheet_name=None,
                primary_reason='product_not_found_in_previous_year',
            )
            continue

        sheet_name = str(sheet.get('sheetName') or sheet.get('product') or '').strip()
        amount = sheet.get('closingStockAmount')
        found = bool(sheet.get('found')) and amount is not None

        if not found:
            reason = str(sheet.get('reason') or 'closing_balance_not_found')
            if _apply_fallback(entry_base, primary_reason=reason):
                continue
            _record_unmatched(
                entry_base,
                reason=reason,
                sheet_name=sheet_name,
                primary_reason=reason,
            )
            continue

        opening_amt_f = _coerce_opening_measure(amount)
        if opening_amt_f is None:
            if _apply_fallback(entry_base, primary_reason='closing_balance_amount_invalid'):
                continue
            _record_unmatched(
                entry_base,
                reason='closing_balance_amount_invalid',
                sheet_name=sheet_name,
                primary_reason='closing_balance_amount_invalid',
            )
            continue

        matched.append(
            {
                **entry_base,
                'openingAmt': opening_amt_f,
                'previousClosingQty': sheet.get('closingStockQty'),
                'previousClosingAmount': opening_amt_f,
                'status': 'matched',
                'sheetName': sheet_name,
            }
        )
        validated_opening.append(
            {
                'product': product,
                'openingQty': opening_qty_f,
                'openingAmt': opening_amt_f,
                'status': 'matched',
                'sheetName': sheet_name,
            }
        )

    total_opening_qty = sum(
        float(r['openingQty']) for r in validated_opening if r.get('openingQty') is not None
    )
    total_opening_amt = sum(
        float(r['openingAmt']) for r in validated_opening if r.get('openingAmt') is not None
    )

    unique_products = {
        str(v.get('product') or '') for v in previous_year_sheets.values() if v.get('product')
    }

    exact_matched_count = len(matched)
    fallback_matched_count = len(fallback_matched)
    total_matched_count = exact_matched_count + fallback_matched_count

    return {
        'validatedOpening': validated_opening,
        'report': {
            'matched': matched,
            'fallbackMatched': fallback_matched,
            'unmatched': unmatched,
            'manualMappingRequired': manual_mapping_required,
            # Backward-compatible aliases for older UI fields.
            'quantityMismatch': [],
            'previousYearMappingRequired': manual_mapping_required,
            'matchedCount': total_matched_count,
            'exactMatchedCount': exact_matched_count,
            'fallbackMatchedCount': fallback_matched_count,
            'unmatchedCount': len(unmatched),
            'manualMappingRequiredCount': len(manual_mapping_required),
            'quantityMismatchCount': 0,
            'previousYearMappingRequiredCount': len(manual_mapping_required),
            'totalOpeningQty': round(total_opening_qty, 6),
            'totalOpeningAmount': round(total_opening_amt, 4),
            'previousYearProductSheetCount': len(unique_products),
        },
    }


def validate_opening_stock(
    *,
    quantity_rows: Sequence[Mapping[str, Any]],
    previous_year_rows: Sequence[Mapping[str, Any]] | None = None,
    previous_year_sheets: Mapping[str, Mapping[str, Any]] | None = None,
    subcategory_products: Mapping[tuple[str, str | None], Sequence[Mapping[str, Any]]]
    | None = None,
    sheet_products: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
    log: Any | None = None,
    **_ignored: Any,
) -> dict[str, Any]:
    """Public entry — prefers previous_year_sheets product index."""
    if previous_year_sheets is None:
        adapted: dict[str, dict[str, Any]] = {}
        for row in previous_year_rows or []:
            product = str(row.get('product') or row.get('sheetName') or '').strip()
            for lookup_key in product_sheet_lookup_keys(product):
                if lookup_key in adapted:
                    continue
                amount = row.get('closingStockAmount')
                adapted[lookup_key] = {
                    'product': product,
                    'sheetName': str(row.get('sheetName') or product),
                    'closingStockAmount': amount,
                    'closingStockQty': row.get('closingStockQty'),
                    'found': amount is not None,
                    'reason': None if amount is not None else 'closing_balance_not_found',
                }
        previous_year_sheets = adapted

    return map_opening_stock_from_product_sheets(
        quantity_rows=quantity_rows,
        previous_year_sheets=previous_year_sheets,
        subcategory_products=subcategory_products,
        sheet_products=sheet_products,
        rule_book=rule_book,
        log=log,
    )

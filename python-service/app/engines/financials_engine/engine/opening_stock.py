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


def map_opening_stock_from_product_sheets(
    *,
    quantity_rows: Sequence[Mapping[str, Any]],
    previous_year_sheets: Mapping[str, Mapping[str, Any]],
    log: Any | None = None,
) -> dict[str, Any]:
    """
    Build Opening Stock from the Quantity file + previous-year Closing Stock product rows.

    - Opening Qty = Quantity file Opening Balance (authority).
    - Opening Amount = that product's Closing stock Amt on Dia/Eme/Prls/Rubi/Prec sheets.
    - Rule Book is NOT used for amount lookup. TOTAL rows are never used.
    - Missing product or Closing Amt → amount blank, logged as unmatched.
    """
    logger = log or get_logger()
    matched: list[dict[str, Any]] = []
    unmatched: list[dict[str, Any]] = []
    validated_opening: list[dict[str, Any]] = []

    seen_keys: set[str] = set()

    for qty_row in quantity_rows:
        product = str(qty_row.get('product') or '').strip()
        key = norm_opening_product_name(product)
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)

        opening_qty = qty_row.get('openingBalance')
        try:
            opening_qty_f = float(opening_qty) if opening_qty is not None else None
        except (TypeError, ValueError):
            opening_qty_f = None

        sheet = _lookup_product_sheet(product, previous_year_sheets)
        entry_base = {
            'product': product,
            'openingQty': opening_qty_f,
            'sku': qty_row.get('sku'),
        }

        if sheet is None:
            unmatched.append(
                {
                    **entry_base,
                    'openingAmt': None,
                    'status': 'unmatched',
                    'reason': 'product_sheet_not_found',
                    'sheetName': None,
                }
            )
            validated_opening.append(
                {
                    'product': product,
                    'openingQty': opening_qty_f,
                    'openingAmt': None,
                    'status': 'unmatched',
                    'reason': 'product_sheet_not_found',
                }
            )
            logger.warning(
                'Opening Stock unmatched: product={} reason=product_not_found_in_previous_year',
                product,
            )
            continue

        sheet_name = str(sheet.get('sheetName') or sheet.get('product') or '').strip()
        amount = sheet.get('closingStockAmount')
        found = bool(sheet.get('found')) and amount is not None

        if not found:
            reason = str(sheet.get('reason') or 'closing_balance_not_found')
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
                    'product': product,
                    'openingQty': opening_qty_f,
                    'openingAmt': None,
                    'status': 'unmatched',
                    'reason': reason,
                    'sheetName': sheet_name,
                }
            )
            logger.warning(
                'Opening Stock unmatched: product={} sheet={} reason={}',
                product,
                sheet_name,
                reason,
            )
            continue

        try:
            opening_amt_f = float(amount)
        except (TypeError, ValueError):
            opening_amt_f = None

        if opening_amt_f is None:
            unmatched.append(
                {
                    **entry_base,
                    'openingAmt': None,
                    'status': 'unmatched',
                    'reason': 'closing_balance_amount_invalid',
                    'sheetName': sheet_name,
                }
            )
            validated_opening.append(
                {
                    'product': product,
                    'openingQty': opening_qty_f,
                    'openingAmt': None,
                    'status': 'unmatched',
                    'reason': 'closing_balance_amount_invalid',
                    'sheetName': sheet_name,
                }
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

    return {
        'validatedOpening': validated_opening,
        'report': {
            'matched': matched,
            'unmatched': unmatched,
            'matchedCount': len(matched),
            'unmatchedCount': len(unmatched),
            'nameMatchedCount': len(matched),
            'quantityMatchedCount': len(matched),
            'quantityMismatchCount': 0,
            'missingFromQuantityFileCount': 0,
            'missingFromPreviousYearFileCount': len(unmatched),
            'missingFromPreviousYearFile': unmatched,
            'quantityMismatch': [],
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
    log: Any | None = None,
) -> dict[str, Any]:
    """Public entry — prefers previous_year_sheets product index."""
    if previous_year_sheets is None:
        adapted: dict[str, dict[str, Any]] = {}
        for row in previous_year_rows or []:
            product = str(row.get('product') or row.get('sheetName') or '').strip()
            for key in product_sheet_lookup_keys(product):
                if key in adapted:
                    continue
                amount = row.get('closingStockAmount')
                adapted[key] = {
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
        log=log,
    )

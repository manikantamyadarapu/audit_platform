"""Closing Stock product → sheet/subcategory mapping from the JSON Rule Book."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.engine.closing_stock_template import (
    CLOSING_STOCK_CATEGORIES,
    subcategory_total_label,
)
from app.engines.financials_engine.engine.opening_stock import (
    apply_fallback_opening_to_layout,
    build_opening_measures_for_layout,
)
from app.utils.logger import get_logger

_RULE_BOOK_PATH = Path(__file__).resolve().parent / 'closing_stock_product_rule_book.json'

_SHEET_KEY_ALIASES: dict[str, str] = {
    'Precious': 'Precious and Semi Precious',
}

_UNICODE_WS = re.compile(
    r'[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+',
    re.UNICODE,
)
_NON_ALNUM = re.compile(r'[^a-z0-9]+', re.IGNORECASE)


def _norm_product(name: str) -> str:
    """Normalize for comparison only — display names stay as in the Rule Book."""
    text = unicodedata.normalize('NFKC', str(name))
    text = _UNICODE_WS.sub(' ', text).strip().casefold()
    return ' '.join(text.split())


def _match_key(name: str) -> str:
    """
    Alphanumeric-only key — ignores spaces/punctuation differences.

    "Flat polki FP1" and "Flatpolki FP 1" → flatpolkifp1
    "Pearls JPS 1000" and "PearlsJPS 1000" → pearlsjps1000
    """
    return _NON_ALNUM.sub('', _norm_product(name))


def _core_sku_key(name: str) -> str:
    """
    Trailing product-code key used when Rule Book adds a category prefix.

    "Pearls JPS 1000" / "JPS 1000" → jps1000
    "Synthetic JSY 100" / "JSY 100" → jsy100
    "Flat polki FP 1" / "FP 1" / "FP1" → fp1
    """
    tokens = _norm_product(name).replace('.', ' ').split()
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
        return ''.join(cleaned)
    start = digit_idx
    if start > 0 and cleaned[start - 1].isalpha():
        start -= 1
    return ''.join(cleaned[start:])


def _coerce_measure(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _round_closing_stock_measure(value: float | None) -> float | None:
    """
    Round a Closing Stock display value to the nearest whole number.

    Decimal < 0.5 → down; decimal >= 0.5 → up.
    Used for product cells and for the final TOTAL after summing unrounded values.
    """
    if value is None:
        return None
    return float(Decimal(str(value)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _clean_product_list(entries: Sequence[Any]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in entries:
        name = str(item).strip()
        if not name:
            continue
        key = _norm_product(name)
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(name)
    return cleaned


def load_closing_stock_product_rule_book(
    path: Path | None = None,
) -> dict[str, Any]:
    """
    Load the Rule Book from disk on every call — no in-memory cache.

    The JSON file is the single source of truth for product names and hierarchy.
    """
    target = path or _RULE_BOOK_PATH
    if not target.exists():
        raise FileNotFoundError(f'Closing Stock product Rule Book not found: {target}')

    raw = json.loads(target.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise ValueError('Closing Stock product Rule Book must be a JSON object')

    normalized_raw: dict[str, Any] = {}
    for key, value in raw.items():
        sheet = _SHEET_KEY_ALIASES.get(str(key).strip(), str(key).strip())
        if sheet in normalized_raw and str(key).strip() != sheet:
            continue
        normalized_raw[sheet] = value

    book: dict[str, Any] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        entries = normalized_raw.get(category)
        if entries is None:
            book[category] = []
            continue
        if isinstance(entries, list):
            book[category] = _clean_product_list(entries)
            continue
        if isinstance(entries, dict):
            subcats: dict[str, list[str]] = {}
            for sub_name, products in entries.items():
                label = str(sub_name).strip()
                if not label:
                    continue
                if not isinstance(products, list):
                    raise ValueError(
                        f'Rule Book subcategory "{category}" / "{label}" must be a list of products'
                    )
                subcats[label] = _clean_product_list(products)
            book[category] = subcats
            continue
        raise ValueError(
            f'Rule Book group "{category}" must be a product list or subcategory object'
        )
    return book


def compute_rule_book_fingerprint(rule_book: Mapping[str, Any] | None = None) -> str:
    """Stable hash of the normalized Rule Book — changes when JSON is edited."""
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    payload = json.dumps(book, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def get_closing_stock_rule_book_payload() -> dict[str, Any]:
    """Current Rule Book JSON plus metadata for API clients (always re-reads disk)."""
    book = load_closing_stock_product_rule_book()
    counts = count_rule_book_products(book)
    mtime = None
    try:
        mtime = _RULE_BOOK_PATH.stat().st_mtime
    except OSError:
        mtime = None
    return {
        'ruleBook': book,
        'ruleBookFingerprint': compute_rule_book_fingerprint(book),
        'ruleBookProductCounts': counts,
        'ruleBookProductTotal': sum(counts.values()),
        'ruleBookPath': str(_RULE_BOOK_PATH),
        'ruleBookMtime': mtime,
        'categories': list(CLOSING_STOCK_CATEGORIES),
    }


def format_closing_stock_mapping_response(category_mapping: Mapping[str, Any]) -> dict[str, Any]:
    """Shape returned to UI / remap endpoint (always from current Rule Book)."""
    return {
        'productsByCategory': category_mapping['productsByCategory'],
        'layoutByCategory': category_mapping['layoutByCategory'],
        'salesByCategory': category_mapping['salesByCategory'],
        'purchasesByCategory': category_mapping['purchasesByCategory'],
        'unmappedProducts': category_mapping['unmappedProducts'],
        'unmappedProductDetails': category_mapping.get('unmappedProductDetails', []),
        'unmappedOpeningProducts': category_mapping.get('unmappedOpeningProducts', []),
        'mappedOpeningProducts': category_mapping.get('mappedOpeningProducts', []),
        'closingStockCategories': category_mapping['categories'],
        'ruleBookFingerprint': category_mapping.get('ruleBookFingerprint'),
        'ruleBookProductCounts': category_mapping.get('ruleBookProductCounts', {}),
        'ruleBookProductTotal': category_mapping.get('ruleBookProductTotal', 0),
        'productsWithSalesData': category_mapping.get('productsWithSalesData', 0),
        'productsWithPurchaseData': category_mapping.get('productsWithPurchaseData', 0),
        'productsWithOpeningData': category_mapping.get('productsWithOpeningData', 0),
        'productsDisplayed': category_mapping.get('productsDisplayed', 0),
        'reconciliation': category_mapping.get('reconciliation', {}),
    }


def count_rule_book_products(rule_book: Mapping[str, Any] | None = None) -> dict[str, int]:
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    counts: dict[str, int] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        section = book.get(category)
        if isinstance(section, list):
            counts[category] = len(section)
        elif isinstance(section, dict):
            counts[category] = sum(len(products) for products in section.values())
        else:
            counts[category] = 0
    return counts


def build_product_location_index(
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, tuple[str, str | None]]:
    """
    Reverse index for pivot → Rule Book location.

    Keys include:
      - whitespace-normalized name
      - alphanumeric match key
      - core SKU key (only when unique across the Rule Book)
    Values are (sheet_name, subcategory_or_None).
    """
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    entries: list[tuple[str, str, str | None]] = []
    for category in CLOSING_STOCK_CATEGORIES:
        section = book.get(category)
        if isinstance(section, list):
            for product in section:
                entries.append((product, category, None))
        elif isinstance(section, dict):
            for subcategory, products in section.items():
                for product in products:
                    entries.append((product, category, subcategory))

    core_owners: dict[str, list[tuple[str, str | None]]] = {}
    for product, category, subcategory in entries:
        core = _core_sku_key(product)
        if core:
            core_owners.setdefault(core, []).append((category, subcategory))

    index: dict[str, tuple[str, str | None]] = {}
    for product, category, subcategory in entries:
        loc = (category, subcategory)
        for key in (_norm_product(product), _match_key(product)):
            if key and key not in index:
                index[key] = loc
        core = _core_sku_key(product)
        if core and len(core_owners.get(core, [])) == 1 and core not in index:
            index[core] = loc
    return index


def resolve_product_location(
    product: str,
    *,
    index: Mapping[str, tuple[str, str | None]] | None = None,
) -> tuple[str, str | None] | None:
    """
    Map a Sales/Purchases pivot name onto a Rule Book location.

    Matching order (never changes the displayed Rule Book name):
      1. whitespace-normalized equality
      2. alphanumeric equality (spacing/punctuation insensitive)
      3. unique core SKU (handles category-prefix renames)
    """
    lookup = index if index is not None else build_product_location_index()
    for key in (_norm_product(product), _match_key(product), _core_sku_key(product)):
        if key and key in lookup:
            return lookup[key]
    return None


def build_product_to_category_index(
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, str]:
    return {key: loc[0] for key, loc in build_product_location_index(rule_book).items()}


def resolve_product_category(
    product: str,
    *,
    index: Mapping[str, str] | None = None,
) -> str | None:
    if index is not None:
        for key in (_norm_product(product), _match_key(product), _core_sku_key(product)):
            if key and key in index:
                return index[key]
        return None
    loc = resolve_product_location(product)
    return loc[0] if loc else None


def _empty_measures() -> dict[str, float | None]:
    return {'sumOfQuantity': None, 'sumOfGross': None}


def _accumulate_measures(
    entry: dict[str, float | None],
    *,
    qty: float | None,
    gross: float | None,
) -> None:
    if qty is not None:
        entry['sumOfQuantity'] = (entry['sumOfQuantity'] or 0.0) + qty
    if gross is not None:
        entry['sumOfGross'] = (entry['sumOfGross'] or 0.0) + gross


def _iter_rule_book_products(
    rule_book: Mapping[str, Any],
) -> list[tuple[str, str | None, str]]:
    """Flatten Rule Book to (category, subcategory, display_name)."""
    rows: list[tuple[str, str | None, str]] = []
    for category in CLOSING_STOCK_CATEGORIES:
        section = rule_book.get(category)
        if isinstance(section, list):
            for product in section:
                rows.append((category, None, product))
        elif isinstance(section, dict):
            for subcategory, products in section.items():
                for product in products:
                    rows.append((category, subcategory, product))
    return rows


def _build_rule_book_match_lookup(
    rule_book: Mapping[str, Any],
) -> dict[str, str]:
    """Map normalized pivot keys → Rule Book display name (one claim per pivot row)."""
    products = _iter_rule_book_products(rule_book)
    core_owners: dict[str, list[str]] = {}
    for _category, _subcategory, display_name in products:
        core = _core_sku_key(display_name)
        if core:
            core_owners.setdefault(core, []).append(display_name)

    lookup: dict[str, str] = {}
    for _category, _subcategory, display_name in products:
        for key in (_norm_product(display_name), _match_key(display_name)):
            if key and key not in lookup:
                lookup[key] = display_name
        core = _core_sku_key(display_name)
        if core and len(core_owners.get(core, [])) == 1 and core not in lookup:
            lookup[core] = display_name
    return lookup


def _resolve_rule_book_display_name(
    pivot_product: str,
    *,
    lookup: Mapping[str, str],
) -> str | None:
    for key in (
        _norm_product(pivot_product),
        _match_key(pivot_product),
        _core_sku_key(pivot_product),
    ):
        if key and key in lookup:
            return lookup[key]
    return None


def resolve_rule_book_display_name(
    product: str,
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> str | None:
    """Public helper — map a product label to its Rule Book display name."""
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    lookup = _build_rule_book_match_lookup(book)
    return _resolve_rule_book_display_name(product, lookup=lookup)


def _aggregate_pivot_by_rule_book(
    rows: Sequence[Mapping[str, Any]] | None,
    *,
    lookup: Mapping[str, str],
) -> tuple[dict[str, dict[str, float | None]], list[dict[str, Any]]]:
    """Claim each pivot row once and SUM onto the matching Rule Book display name."""
    by_display: dict[str, dict[str, float | None]] = {}
    unmapped_rows: list[dict[str, Any]] = []

    for row in rows or ():
        product_name = str(row.get('product') or '').strip()
        if not product_name:
            continue
        qty = _coerce_measure(row.get('sumOfQuantity'))
        gross = _coerce_measure(row.get('sumOfGross'))
        display_name = _resolve_rule_book_display_name(product_name, lookup=lookup)
        if display_name is None:
            unmapped_rows.append(
                {
                    'product': product_name,
                    'sumOfQuantity': qty,
                    'sumOfGross': gross,
                }
            )
            continue
        entry = by_display.setdefault(display_name, _empty_measures())
        _accumulate_measures(entry, qty=qty, gross=gross)

    return by_display, unmapped_rows


def _raw_product_measures(
    rule_book_product: str,
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]] | None = None,
) -> dict[str, float | None]:
    """Original (unrounded) pivot measures for one Rule Book product."""
    sales = sales_by_display.get(rule_book_product, {})
    purchases = purchases_by_display.get(rule_book_product, {})
    opening = (opening_by_display or {}).get(rule_book_product, {})
    return {
        'openingQty': opening.get('sumOfQuantity'),
        'openingAmt': opening.get('sumOfGross'),
        'purchasesQty': purchases.get('sumOfQuantity'),
        'purchasesAmt': purchases.get('sumOfGross'),
        'salesQty': sales.get('sumOfQuantity'),
        'salesAmt': sales.get('sumOfGross'),
    }


def _display_product_measures(raw: Mapping[str, float | None]) -> dict[str, float | None]:
    """Product-level display: round Amounts only; Quantity stays exact."""
    return {
        'openingQty': raw.get('openingQty'),
        'openingAmt': _round_closing_stock_measure(raw.get('openingAmt')),
        'purchasesQty': raw.get('purchasesQty'),
        'purchasesAmt': _round_closing_stock_measure(raw.get('purchasesAmt')),
        'salesQty': raw.get('salesQty'),
        'salesAmt': _round_closing_stock_measure(raw.get('salesAmt')),
    }


_MEASURE_KEYS = (
    'openingQty',
    'openingAmt',
    'purchasesQty',
    'purchasesAmt',
    'salesQty',
    'salesAmt',
)


def _total_measures_from_raw(
    raw_rows: Sequence[Mapping[str, float | None]],
) -> dict[str, float | None]:
    """
    TOTAL / GRAND TOTAL from original unrounded pivot values.

    Amounts: ROUND(SUM(unrounded)) — never sum of already-rounded product cells.
    Quantity: SUM(unrounded) with no rounding.
    """
    totals: dict[str, float] = {}
    present: set[str] = set()
    for raw in raw_rows:
        for key in _MEASURE_KEYS:
            value = _coerce_measure(raw.get(key))
            if value is None:
                continue
            totals[key] = totals.get(key, 0.0) + value
            present.add(key)

    def _finalize(key: str) -> float | None:
        if key not in present:
            return None
        if key.endswith('Amt'):
            return _round_closing_stock_measure(totals[key])
        return totals[key]

    return {key: _finalize(key) for key in _MEASURE_KEYS}


def _product_measures_from_maps(
    rule_book_product: str,
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]] | None = None,
) -> dict[str, float | None]:
    raw = _raw_product_measures(
        rule_book_product,
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        opening_by_display=opening_by_display,
    )
    return _display_product_measures(raw)


def _build_layout_for_category(
    category: str,
    *,
    rule_section: Any,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    """
    Build sheet layout from the Rule Book master list.

    Every Rule Book product is included even when measures are blank/null.
    Product Amounts are rounded for display; TOTAL Amounts use ROUND(SUM(unrounded)).
    """
    layout: list[dict[str, Any]] = []
    flat_products: list[str] = []
    sheet_raw: list[dict[str, float | None]] = []
    opening_map = opening_by_display or {}

    def _append_product(product: str, subcategory: str | None) -> None:
        raw = _raw_product_measures(
            product,
            sales_by_display=sales_by_display,
            purchases_by_display=purchases_by_display,
            opening_by_display=opening_map,
        )
        display = _display_product_measures(raw)
        layout.append(
            {
                'kind': 'product',
                'label': product,
                'subcategory': subcategory,
                **{key: display[key] for key in _MEASURE_KEYS},
            }
        )
        flat_products.append(product)
        sheet_raw.append(raw)

    if isinstance(rule_section, dict):
        for subcategory, rule_products in rule_section.items():
            products = list(rule_products or [])
            if not products:
                continue
            layout.append(
                {
                    'kind': 'subcategory',
                    'label': subcategory,
                    'subcategory': subcategory,
                }
            )
            subcategory_raw: list[dict[str, float | None]] = []
            for product in products:
                raw = _raw_product_measures(
                    product,
                    sales_by_display=sales_by_display,
                    purchases_by_display=purchases_by_display,
                    opening_by_display=opening_map,
                )
                display = _display_product_measures(raw)
                layout.append(
                    {
                        'kind': 'product',
                        'label': product,
                        'subcategory': subcategory,
                        **{key: display[key] for key in _MEASURE_KEYS},
                    }
                )
                flat_products.append(product)
                subcategory_raw.append(raw)
                sheet_raw.append(raw)
            layout.append(
                {
                    'kind': 'subcategory_total',
                    'label': subcategory_total_label(category, subcategory),
                    'subcategory': subcategory,
                    **_total_measures_from_raw(subcategory_raw),
                }
            )
    elif isinstance(rule_section, list):
        for product in rule_section:
            _append_product(product, None)

    if flat_products:
        layout.append(
            {
                'kind': 'grand_total',
                'label': 'GRAND TOTAL',
                'subcategory': None,
                **_total_measures_from_raw(sheet_raw),
            }
        )
    return layout, flat_products


def _build_category_pivot_lists(
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    location_index: Mapping[str, tuple[str, str | None]],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[dict[str, Any]]]]:
    sales_by_category: dict[str, list[dict[str, Any]]] = {c: [] for c in CLOSING_STOCK_CATEGORIES}
    purchases_by_category: dict[str, list[dict[str, Any]]] = {
        c: [] for c in CLOSING_STOCK_CATEGORIES
    }

    def _fill(
        by_display: Mapping[str, dict[str, float | None]],
        target: dict[str, list[dict[str, Any]]],
    ) -> None:
        for display_name, measures in by_display.items():
            loc = resolve_product_location(display_name, index=location_index)
            if loc is None:
                continue
            category, subcategory = loc
            target[category].append(
                {
                    'product': display_name,
                    'sumOfQuantity': measures.get('sumOfQuantity'),
                    'sumOfGross': measures.get('sumOfGross'),
                    'subcategory': subcategory,
                }
            )

    _fill(sales_by_display, sales_by_category)
    _fill(purchases_by_display, purchases_by_category)
    return sales_by_category, purchases_by_category


def _count_products_with_measures(
    products_by_category: Mapping[str, Sequence[str]],
    by_display: Mapping[str, dict[str, float | None]],
) -> int:
    count = 0
    seen: set[str] = set()
    for products in products_by_category.values():
        for product in products:
            key = _norm_product(product)
            if not key or key in seen:
                continue
            seen.add(key)
            entry = by_display.get(product, {})
            if entry.get('sumOfQuantity') is not None or entry.get('sumOfGross') is not None:
                count += 1
    return count


def _sum_measure_map(
    by_display: Mapping[str, dict[str, float | None]],
    *,
    round_for_closing_stock: bool = False,
) -> tuple[float, float]:
    qty_total = 0.0
    amt_total = 0.0
    for entry in by_display.values():
        qty = _coerce_measure(entry.get('sumOfQuantity'))
        gross = _coerce_measure(entry.get('sumOfGross'))
        if round_for_closing_stock:
            # Amounts are rounded for product display; quantities stay exact.
            gross = _round_closing_stock_measure(gross)
        if qty is not None:
            qty_total += qty
        if gross is not None:
            amt_total += gross
    return round(qty_total, 4), round(amt_total, 4)


def _sum_pivot_rows(
    rows: Sequence[Mapping[str, Any]] | None,
) -> tuple[float, float]:
    qty_total = 0.0
    amt_total = 0.0
    for row in rows or ():
        qty = _coerce_measure(row.get('sumOfQuantity'))
        gross = _coerce_measure(row.get('sumOfGross'))
        if qty is not None:
            qty_total += qty
        if gross is not None:
            amt_total += gross
    return round(qty_total, 4), round(amt_total, 4)


def _sum_output_measures(
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]],
) -> tuple[float, float, float, float]:
    sales_qty = 0.0
    sales_amt = 0.0
    purchases_qty = 0.0
    purchases_amt = 0.0
    for layout in layout_by_category.values():
        for row in layout:
            if row.get('kind') != 'product':
                continue
            sq = _coerce_measure(row.get('salesQty'))
            sa = _coerce_measure(row.get('salesAmt'))
            pq = _coerce_measure(row.get('purchasesQty'))
            pa = _coerce_measure(row.get('purchasesAmt'))
            if sq is not None:
                sales_qty += sq
            if sa is not None:
                sales_amt += sa
            if pq is not None:
                purchases_qty += pq
            if pa is not None:
                purchases_amt += pa
    return (
        round(sales_qty, 4),
        round(sales_amt, 4),
        round(purchases_qty, 4),
        round(purchases_amt, 4),
    )


def _build_reconciliation(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None,
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]],
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    unmapped_sales: Sequence[Mapping[str, Any]],
    unmapped_purchases: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    pivot_sales_qty, pivot_sales_amt = _sum_pivot_rows(sales_pivot)
    pivot_purchases_qty, pivot_purchases_amt = _sum_pivot_rows(purchases_pivot)
    # Unrounded mapped totals (match pivot math before Closing Stock rounding).
    mapped_sales_qty, mapped_sales_amt = _sum_measure_map(sales_by_display)
    mapped_purchases_qty, mapped_purchases_amt = _sum_measure_map(purchases_by_display)
    # Rounded per-product totals must match Closing Stock layout output.
    rounded_sales_qty, rounded_sales_amt = _sum_measure_map(
        sales_by_display, round_for_closing_stock=True
    )
    rounded_purchases_qty, rounded_purchases_amt = _sum_measure_map(
        purchases_by_display, round_for_closing_stock=True
    )
    unmapped_sales_qty, unmapped_sales_amt = _sum_pivot_rows(unmapped_sales)
    unmapped_purchases_qty, unmapped_purchases_amt = _sum_pivot_rows(unmapped_purchases)
    out_sales_qty, out_sales_amt, out_purchases_qty, out_purchases_amt = _sum_output_measures(
        layout_by_category
    )

    def _eq(a: float, b: float) -> bool:
        return abs(a - b) <= 1e-4

    mapped_matches_output = (
        _eq(rounded_sales_qty, out_sales_qty)
        and _eq(rounded_sales_amt, out_sales_amt)
        and _eq(rounded_purchases_qty, out_purchases_qty)
        and _eq(rounded_purchases_amt, out_purchases_amt)
    )
    pivot_matches_output = (
        _eq(pivot_sales_qty, out_sales_qty)
        and _eq(pivot_sales_amt, out_sales_amt)
        and _eq(pivot_purchases_qty, out_purchases_qty)
        and _eq(pivot_purchases_amt, out_purchases_amt)
    )
    pivot_split_match = (
        _eq(mapped_sales_qty + unmapped_sales_qty, pivot_sales_qty)
        and _eq(mapped_sales_amt + unmapped_sales_amt, pivot_sales_amt)
        and _eq(mapped_purchases_qty + unmapped_purchases_qty, pivot_purchases_qty)
        and _eq(mapped_purchases_amt + unmapped_purchases_amt, pivot_purchases_amt)
    )

    return {
        'salesPivotQty': pivot_sales_qty,
        'salesPivotAmt': pivot_sales_amt,
        'purchasesPivotQty': pivot_purchases_qty,
        'purchasesPivotAmt': pivot_purchases_amt,
        'mappedSalesQty': mapped_sales_qty,
        'mappedSalesAmt': mapped_sales_amt,
        'mappedPurchasesQty': mapped_purchases_qty,
        'mappedPurchasesAmt': mapped_purchases_amt,
        'unmappedSalesQty': unmapped_sales_qty,
        'unmappedSalesAmt': unmapped_sales_amt,
        'unmappedPurchasesQty': unmapped_purchases_qty,
        'unmappedPurchasesAmt': unmapped_purchases_amt,
        'outputSalesQty': out_sales_qty,
        'outputSalesAmt': out_sales_amt,
        'outputPurchasesQty': out_purchases_qty,
        'outputPurchasesAmt': out_purchases_amt,
        'salesQtyMatch': _eq(pivot_sales_qty, out_sales_qty),
        'salesAmtMatch': _eq(pivot_sales_amt, out_sales_amt),
        'purchasesQtyMatch': _eq(pivot_purchases_qty, out_purchases_qty),
        'purchasesAmtMatch': _eq(pivot_purchases_amt, out_purchases_amt),
        'mappedOutputMatch': mapped_matches_output,
        'pivotOutputMatch': pivot_matches_output,
        'pivotSplitMatch': pivot_split_match,
        'unmappedProductCount': len(unmapped_sales) + len(unmapped_purchases),
    }


def map_pivots_to_closing_stock_categories(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    opening_pivot: Sequence[Mapping[str, Any]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Build Closing Stock from the Rule Book (master list) and LEFT JOIN pivot values.

    Display names always come from the Rule Book. Sales/Purchases/Opening Qty/Amt are
    the SUM of matching pivot rows (normalized / alphanumeric / unique core SKU).
    """
    log = get_logger('closing-stock-rule-book')
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    rule_book_fingerprint = compute_rule_book_fingerprint(book)
    location_index = build_product_location_index(book)
    rule_counts = count_rule_book_products(book)
    total_rule_products = sum(rule_counts.values())
    match_lookup = _build_rule_book_match_lookup(book)

    log.info(
        'Rule Book loaded from disk: path={} mtime={} total_products={} fingerprint={}',
        str(_RULE_BOOK_PATH),
        _RULE_BOOK_PATH.stat().st_mtime if _RULE_BOOK_PATH.exists() else None,
        total_rule_products,
        rule_book_fingerprint[:12],
    )
    for category in CLOSING_STOCK_CATEGORIES:
        log.info('Rule Book products — {}: {}', category, rule_counts.get(category, 0))

    sales_by_display, unmapped_sales_rows = _aggregate_pivot_by_rule_book(
        sales_pivot,
        lookup=match_lookup,
    )
    purchases_by_display, unmapped_purchases_rows = _aggregate_pivot_by_rule_book(
        purchases_pivot,
        lookup=match_lookup,
    )
    layout_product_names = [display for _cat, _sub, display in _iter_rule_book_products(book)]
    opening_by_display, unmapped_opening_rows = build_opening_measures_for_layout(
        opening_pivot,
        layout_product_names,
    )
    opening_by_display, unmapped_opening_rows = apply_fallback_opening_to_layout(
        opening_by_display,
        opening_pivot,
        rule_book=book,
        unmapped_rows=unmapped_opening_rows,
    )

    unmapped: list[str] = []
    unmapped_details: list[dict[str, str]] = []
    unmapped_seen: set[str] = set()
    for source, rows in (
        ('Sales', unmapped_sales_rows),
        ('Purchases', unmapped_purchases_rows),
        ('Opening', unmapped_opening_rows),
    ):
        for row in rows:
            product_name = str(row.get('product') or '')
            key = _norm_product(product_name)
            if not key or key in unmapped_seen:
                continue
            unmapped_seen.add(key)
            unmapped.append(product_name)
            unmapped_details.append({'product': product_name, 'source': source})
            log.warning('Unmapped pivot product: {} Source: {}', product_name, source)

    sales_by_category, purchases_by_category = _build_category_pivot_lists(
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        location_index=location_index,
    )

    products_by_category: dict[str, list[str]] = {}
    layout_by_category: dict[str, list[dict[str, Any]]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        layout, flat = _build_layout_for_category(
            category,
            rule_section=book.get(category),
            sales_by_display=sales_by_display,
            purchases_by_display=purchases_by_display,
            opening_by_display=opening_by_display,
        )
        layout_by_category[category] = layout
        products_by_category[category] = flat

    mapped_count = sum(len(v) for v in products_by_category.values())
    products_with_sales = _count_products_with_measures(products_by_category, sales_by_display)
    products_with_purchases = _count_products_with_measures(
        products_by_category,
        purchases_by_display,
    )
    products_with_opening = _count_products_with_measures(
        products_by_category,
        opening_by_display,
    )

    mapped_opening_products = [
        {
            'product': name,
            'openingQty': measures.get('sumOfQuantity'),
            'openingAmt': measures.get('sumOfGross'),
        }
        for name, measures in opening_by_display.items()
    ]

    log.info(
        'Closing Stock fill — rule_book={} displayed={} with_sales={} with_purchases={} '
        'with_opening={} pivot_unmapped={}',
        total_rule_products,
        mapped_count,
        products_with_sales,
        products_with_purchases,
        products_with_opening,
        len(unmapped),
    )
    if mapped_count != total_rule_products:
        log.error(
            'Rule Book product count mismatch: expected {} displayed {}',
            total_rule_products,
            mapped_count,
        )

    reconciliation = _build_reconciliation(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        layout_by_category=layout_by_category,
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        unmapped_sales=unmapped_sales_rows,
        unmapped_purchases=unmapped_purchases_rows,
    )

    log.info(
        'Reconciliation — sales pivot={} mapped={} output={} | '
        'purchases pivot={} mapped={} output={} | mapped_ok={} split_ok={} unmapped={}',
        reconciliation['salesPivotQty'],
        reconciliation['mappedSalesQty'],
        reconciliation['outputSalesQty'],
        reconciliation['purchasesPivotQty'],
        reconciliation['mappedPurchasesQty'],
        reconciliation['outputPurchasesQty'],
        reconciliation['mappedOutputMatch'],
        reconciliation['pivotSplitMatch'],
        len(unmapped),
    )
    if not reconciliation['mappedOutputMatch']:
        log.error('Mapped pivot totals do not match Closing Stock output totals')
    if not reconciliation['pivotOutputMatch']:
        log.warning(
            'Full pivot totals differ from output due to unmapped products '
            '(sales_qty={} sales_amt={} purchases_qty={} purchases_amt={})',
            reconciliation['unmappedSalesQty'],
            reconciliation['unmappedSalesAmt'],
            reconciliation['unmappedPurchasesQty'],
            reconciliation['unmappedPurchasesAmt'],
        )

    return {
        'productsByCategory': products_by_category,
        'layoutByCategory': layout_by_category,
        'salesByCategory': sales_by_category,
        'purchasesByCategory': purchases_by_category,
        'unmappedProducts': unmapped,
        'unmappedProductDetails': unmapped_details,
        'unmappedOpeningProducts': [
            str(r.get('product') or '') for r in unmapped_opening_rows if r.get('product')
        ],
        'mappedOpeningProducts': mapped_opening_products,
        'ruleBookProductCounts': rule_counts,
        'ruleBookProductTotal': total_rule_products,
        'ruleBookFingerprint': rule_book_fingerprint,
        'productsWithSalesData': products_with_sales,
        'productsWithPurchaseData': products_with_purchases,
        'productsWithOpeningData': products_with_opening,
        'productsDisplayed': mapped_count,
        'reconciliation': reconciliation,
        'categories': list(CLOSING_STOCK_CATEGORIES),
    }


def map_product_names_to_categories(
    products: Sequence[str],
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, list[str]]:
    """Return ALL Rule Book products per category."""
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    result: dict[str, list[str]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        _, flat = _build_layout_for_category(
            category,
            rule_section=book.get(category),
            sales_by_display={},
            purchases_by_display={},
        )
        result[category] = flat
    return result


def map_product_names_to_layouts(
    products: Sequence[str],
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[],
        purchases_pivot=[],
        rule_book=rule_book,
    )
    return mapped['layoutByCategory']

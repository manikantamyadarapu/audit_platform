"""Closing Stock product → sheet/subcategory mapping from the JSON Rule Book."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.engine.closing_stock_template import (
    CLOSING_STOCK_CATEGORIES,
    subcategory_total_label,
)
from app.utils.logger import get_logger

_RULE_BOOK_PATH = Path(__file__).resolve().parent / 'closing_stock_product_rule_book.json'

# Accept legacy key "Precious" when reading older Rule Book files.
_SHEET_KEY_ALIASES: dict[str, str] = {
    'Precious': 'Precious and Semi Precious',
}

# Punctuation / separators collapsed for comparison only (display names stay original).
_NON_ALNUM = re.compile(r'[^a-z0-9]+', re.IGNORECASE)


def _norm_product(name: str) -> str:
    """Normalize for matching: trim, casefold, collapse punctuation/whitespace."""
    text = str(name).strip().casefold()
    text = _NON_ALNUM.sub(' ', text)
    return ' '.join(text.split())


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
    Load the manually maintained product Rule Book.

    Shape per main category:
      - flat list → sheet with products + GRAND TOTAL (Emerald, Pearls, Rubie)
      - object of subcategory → product lists (Diamond, Precious and Semi Precious)
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


def build_product_location_index(
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, tuple[str, str | None]]:
    """
    Reverse index: normalized product → (sheet_name, subcategory_or_None).

    First occurrence in CLOSING_STOCK_CATEGORIES / subcategory order wins.
    """
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    index: dict[str, tuple[str, str | None]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        section = book.get(category)
        if isinstance(section, list):
            for product in section:
                key = _norm_product(product)
                if key and key not in index:
                    index[key] = (category, None)
        elif isinstance(section, dict):
            for subcategory, products in section.items():
                for product in products:
                    key = _norm_product(product)
                    if key and key not in index:
                        index[key] = (category, subcategory)
    return index


def resolve_product_location(
    product: str,
    *,
    index: Mapping[str, tuple[str, str | None]] | None = None,
) -> tuple[str, str | None] | None:
    """
    Resolve (sheet, subcategory) for a pivot product name.

    Matching order:
      1. Exact normalized equality
      2. Longest token-suffix match (e.g. "Emeralds JEM 100" → "JEM 100")
    """
    lookup = index if index is not None else build_product_location_index()
    key = _norm_product(product)
    if not key:
        return None
    if key in lookup:
        return lookup[key]

    tokens = key.split()
    best: tuple[str, str | None] | None = None
    best_len = 0
    for rule_key, loc in lookup.items():
        rule_tokens = rule_key.split()
        n = len(rule_tokens)
        if n == 0 or n > len(tokens):
            continue
        if tokens[-n:] == rule_tokens and n > best_len:
            best = loc
            best_len = n
    return best


def build_product_to_category_index(
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, str]:
    """Normalized product → sheet name (compatibility helper)."""
    return {key: loc[0] for key, loc in build_product_location_index(rule_book).items()}


def resolve_product_category(
    product: str,
    *,
    index: Mapping[str, str] | None = None,
) -> str | None:
    """Return the Closing Stock sheet name for a product, or None if unmapped."""
    if index is not None:
        key = _norm_product(product)
        if key in index:
            return index[key]
        # Suffix fallback against category-only index
        tokens = key.split()
        best = None
        best_len = 0
        for rule_key, category in index.items():
            rule_tokens = rule_key.split()
            n = len(rule_tokens)
            if n and n <= len(tokens) and tokens[-n:] == rule_tokens and n > best_len:
                best = category
                best_len = n
        return best
    loc = resolve_product_location(product)
    return loc[0] if loc else None


def _empty_category_maps() -> tuple[
    dict[str, list[str]],
    dict[str, list[dict[str, Any]]],
    dict[str, list[dict[str, Any]]],
]:
    products = {c: [] for c in CLOSING_STOCK_CATEGORIES}
    sales = {c: [] for c in CLOSING_STOCK_CATEGORIES}
    purchases = {c: [] for c in CLOSING_STOCK_CATEGORIES}
    return products, sales, purchases


def _build_layout_for_category(
    category: str,
    *,
    rule_section: Any,
    matched_display_by_norm: Mapping[str, str],
) -> tuple[list[dict[str, Any]], list[str]]:
    """
    Build Particulars rows for one sheet from Rule Book order + matched pivot products.

    Returns (layout_rows, flat_product_names).
    """
    layout: list[dict[str, Any]] = []
    flat_products: list[str] = []

    def _matched_in_order(rule_products: Sequence[str]) -> list[str]:
        ordered: list[str] = []
        claimed: set[str] = set()
        for rule_name in rule_products:
            rule_key = _norm_product(rule_name)
            # Prefer exact key, then any matched display whose tokens end with this rule key.
            display = matched_display_by_norm.get(rule_key)
            if display:
                ordered.append(display)
                claimed.add(rule_key)
                continue
            for matched_key, matched_name in matched_display_by_norm.items():
                if matched_key in claimed:
                    continue
                matched_tokens = matched_key.split()
                rule_tokens = rule_key.split()
                n = len(rule_tokens)
                if n and matched_tokens[-n:] == rule_tokens:
                    ordered.append(matched_name)
                    claimed.add(matched_key)
                    break
        return ordered

    if isinstance(rule_section, dict):
        for subcategory, rule_products in rule_section.items():
            matched = _matched_in_order(rule_products)
            if not matched:
                continue
            layout.append(
                {
                    'kind': 'subcategory',
                    'label': subcategory,
                    'subcategory': subcategory,
                }
            )
            for product in matched:
                layout.append(
                    {
                        'kind': 'product',
                        'label': product,
                        'subcategory': subcategory,
                    }
                )
                flat_products.append(product)
            layout.append(
                {
                    'kind': 'subcategory_total',
                    'label': subcategory_total_label(category, subcategory),
                    'subcategory': subcategory,
                }
            )
    elif isinstance(rule_section, list):
        matched = _matched_in_order(rule_section)
        for product in matched:
            layout.append({'kind': 'product', 'label': product, 'subcategory': None})
            flat_products.append(product)

    if flat_products or layout:
        layout.append({'kind': 'grand_total', 'label': 'GRAND TOTAL', 'subcategory': None})
    return layout, flat_products


def map_pivots_to_closing_stock_categories(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Route Sales/Purchases pivot rows onto Closing Stock sheets via the Rule Book.

    Hierarchy: Product → Main Category → Subcategory → Sheet.
    A product appearing in either Sales or Purchases is included.
    """
    log = get_logger('closing-stock-rule-book')
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    location_index = build_product_location_index(book)
    log.info(
        'Rule Book loaded: path={} indexed_products={}',
        str(_RULE_BOOK_PATH),
        len(location_index),
    )

    products_by_category, sales_by_category, purchases_by_category = _empty_category_maps()
    matched_display: dict[str, dict[str, str]] = {c: {} for c in CLOSING_STOCK_CATEGORIES}
    unmapped: list[str] = []
    unmapped_seen: set[str] = set()
    unmapped_details: list[dict[str, str]] = []

    def _note_product(category: str, product_name: str) -> None:
        key = _norm_product(product_name)
        if not key:
            return
        matched_display[category].setdefault(key, product_name)

    def _route_rows(
        rows: Sequence[Mapping[str, Any]],
        target: dict[str, list[dict[str, Any]]],
        *,
        source: str,
    ) -> None:
        for row in rows:
            product_name = str(row.get('product') or '').strip()
            if not product_name:
                continue
            loc = resolve_product_location(product_name, index=location_index)
            if loc is None:
                key = _norm_product(product_name)
                if key not in unmapped_seen:
                    unmapped_seen.add(key)
                    unmapped.append(product_name)
                    unmapped_details.append({'product': product_name, 'source': source})
                    log.warning('Unmapped product: {} Source: {}', product_name, source)
                continue
            category, subcategory = loc
            _note_product(category, product_name)
            target[category].append(
                {
                    'product': product_name,
                    'sumOfQuantity': row.get('sumOfQuantity'),
                    'sumOfGross': row.get('sumOfGross'),
                    'subcategory': subcategory,
                }
            )

    _route_rows(sales_pivot or (), sales_by_category, source='Sales')
    _route_rows(purchases_pivot or (), purchases_by_category, source='Purchases')

    layout_by_category: dict[str, list[dict[str, Any]]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        layout, flat = _build_layout_for_category(
            category,
            rule_section=book.get(category),
            matched_display_by_norm=matched_display[category],
        )
        layout_by_category[category] = layout
        products_by_category[category] = flat

    mapped_count = sum(len(v) for v in products_by_category.values())
    log.info(
        'Closing Stock mapping complete: mapped={} unmapped={}',
        mapped_count,
        len(unmapped),
    )

    return {
        'productsByCategory': products_by_category,
        'layoutByCategory': layout_by_category,
        'salesByCategory': sales_by_category,
        'purchasesByCategory': purchases_by_category,
        'unmappedProducts': unmapped,
        'unmappedProductDetails': unmapped_details,
        'categories': list(CLOSING_STOCK_CATEGORIES),
    }


def map_product_names_to_categories(
    products: Sequence[str],
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, list[str]]:
    """Map a flat product name list onto category sheets using the Rule Book."""
    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[{'product': p, 'sumOfQuantity': None, 'sumOfGross': None} for p in products],
        purchases_pivot=[],
        rule_book=rule_book,
    )
    return mapped['productsByCategory']


def map_product_names_to_layouts(
    products: Sequence[str],
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    """Map product names to full sheet layouts (subcategory / TOTAL / GRAND TOTAL rows)."""
    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[{'product': p, 'sumOfQuantity': None, 'sumOfGross': None} for p in products],
        purchases_pivot=[],
        rule_book=rule_book,
    )
    return mapped['layoutByCategory']

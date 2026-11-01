"""Jubilee Hills product placement. Basheerbagh and Kokapet do not use this."""

from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    CLOSING_STOCK_CATEGORIES,
    _IncrementalProductLookup,
    _build_rule_book_match_lookup,
    _coerce_measure,
    _display_product_measures,
    _raw_product_measures,
    _resolve_closing_stock_sheet,
    _trading_account_product,
    iter_mr_dc_rows,
    _resolve_rule_book_display_name,
    _sorted_product_names,
    _total_measures_from_raw,
    load_closing_stock_product_rule_book,
)
from app.engines.financials_engine.engine.closing_stock_template import subcategory_total_label

# Product-name codes. These choose the sheet. The Rule Book does not.
_PRODUCT_CODE_SHEETS: tuple[tuple[str, str], ...] = (
    ('JEM', 'Emerald'),
    ('JPS', 'Pearls'),
    ('JRU', 'Rubie'),
)

PRECIOUS_SHEET = 'Precious and Semi Precious'
PRECIOUS_SUBCATEGORY_ORDER: tuple[str, ...] = (
    'Precious Stones',
    'Semi Precious',
    'Synthetic Stones',
)

DIAMOND_SHEET = 'Diamond'
DIAMOND_SUBCATEGORY_ORDER: tuple[str, ...] = (
    'Uncut - Diamonds',
    'Diamonds - Flat Polki',
    'Diamonds - Black Diamonds',
    'Diamonds - Beads',
    'Diamonds - Rosecut Diamonds',
    'Diamonds',
)


def _code_pattern(code: str) -> re.Pattern[str]:
    """Product code, allowing space or punctuation between the letters."""
    body = r'[\s.\-_]*'.join(re.escape(letter) for letter in code)
    return re.compile(rf'(?<![A-Za-z]){body}(?![A-Za-z])', re.IGNORECASE)


def _word_pattern(word: str) -> re.Pattern[str]:
    return re.compile(rf'(?<![A-Za-z]){re.escape(word)}(?![A-Za-z])', re.IGNORECASE)


def _phrase_pattern(*words: str) -> re.Pattern[str]:
    body = r'[\s.\-_]*'.join(re.escape(word) for word in words)
    return re.compile(rf'(?<![A-Za-z]){body}(?![A-Za-z])', re.IGNORECASE)


# Most specific Diamond rule first. The Rule Book is not consulted.
_DIAMOND_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (_code_pattern('DB'), 'Diamonds - Beads'),
    (_phrase_pattern('Di', 'Beads'), 'Diamonds - Beads'),
    (_code_pattern('RC'), 'Diamonds - Rosecut Diamonds'),
    (_code_pattern('FP'), 'Diamonds - Flat Polki'),
    (_code_pattern('BD'), 'Diamonds - Black Diamonds'),
    (_phrase_pattern('Black', 'Diamonds'), 'Diamonds - Black Diamonds'),
    (_code_pattern('RA'), 'Diamonds'),
    (_code_pattern('SD'), 'Diamonds'),
    (_word_pattern('Chakri'), 'Uncut - Diamonds'),
    (_phrase_pattern('Flat', 'Polki'), 'Diamonds - Flat Polki'),
    (_word_pattern('Polki'), 'Uncut - Diamonds'),
)


def jubilee_diamond_subcategory(product: str) -> str | None:
    """Return the Diamond subcategory when a Diamond regex matches. Otherwise None."""
    text = str(product or '')
    for pattern, subcategory in _DIAMOND_RULES:
        if pattern.search(text):
            return subcategory
    return None


def _diamond_location(product: str) -> tuple[str, str] | None:
    subcategory = jubilee_diamond_subcategory(product)
    if subcategory is None:
        return None
    return DIAMOND_SHEET, subcategory


# JOS, JSP, and JSY. The Rule Book is not consulted.
_PRECIOUS_RULES: tuple[tuple[re.Pattern[str], str], ...] = (
    (_code_pattern('JOS'), 'Precious Stones'),
    (_code_pattern('JSP'), 'Semi Precious'),
    (_code_pattern('JSY'), 'Synthetic Stones'),
)


def jubilee_precious_subcategory(product: str) -> str | None:
    """Return the Precious subcategory when JOS, JSP, or JSY matches. Otherwise None."""
    text = str(product or '')
    for pattern, subcategory in _PRECIOUS_RULES:
        if pattern.search(text):
            return subcategory
    return None


def _precious_location(product: str) -> tuple[str, str] | None:
    subcategory = jubilee_precious_subcategory(product)
    if subcategory is None:
        return None
    return PRECIOUS_SHEET, subcategory


def locate_jubilee_hills_product(product: str) -> tuple[tuple[str, str | None], str] | None:
    """Sheet and subcategory for Jubilee Hills, Basheerbagh, and Kokapet."""
    diamond = _diamond_location(product)
    if diamond is not None:
        return diamond, 'diamond-regex'
    precious = _precious_location(product)
    if precious is not None:
        return precious, 'precious-code'
    coded = _code_location(product)
    if coded is not None:
        return coded, 'product-code'
    return None


def _opening_qty(row: Mapping[str, Any]) -> float | None:
    if row.get('sumOfQuantity') is not None:
        return _coerce_measure(row.get('sumOfQuantity'))
    return _coerce_measure(row.get('openingQty'))


def _code_location(product: str) -> tuple[str, str | None] | None:
    """JEM → Emerald, JPS → Pearls, JRU → Rubie when that code is in the name."""
    for code, sheet in _PRODUCT_CODE_SHEETS:
        if re.search(rf'(?<![A-Za-z]){code}', product, flags=re.IGNORECASE):
            return sheet, None
    return None


def _opening_is_blank_or_zero(row: Mapping[str, Any]) -> bool:
    qty = _opening_qty(row)
    return qty is None or qty == 0


def _name_lookup(names: Sequence[str]) -> dict[str, str]:
    book = {category: [] for category in CLOSING_STOCK_CATEGORIES}
    book['Diamond'] = [str(name).strip() for name in names if str(name).strip()]
    return _build_rule_book_match_lookup(book)


def _already_placed(product: str, lookup: Mapping[str, str]) -> bool:
    return _resolve_rule_book_display_name(product, lookup=lookup) is not None


def _previous_year_location(row: Mapping[str, Any]) -> tuple[str, str | None] | None:
    subcategory = str(row.get('subcategory') or '').strip() or None
    for key in ('category', 'sheetName'):
        sheet = _resolve_closing_stock_sheet(str(row.get(key) or ''))
        if sheet:
            return sheet, subcategory
    return None


def _row_qty(row: Mapping[str, Any]) -> float | None:
    if row.get('sumOfQuantity') is not None:
        return _coerce_measure(row.get('sumOfQuantity'))
    return _coerce_measure(row.get('openingQty'))


def _row_gross(row: Mapping[str, Any]) -> float | None:
    if row.get('sumOfGross') is not None:
        return _coerce_measure(row.get('sumOfGross'))
    return _coerce_measure(row.get('openingAmt'))


def _measure_map_for_placed(
    rows: Sequence[Mapping[str, Any]] | None,
    placed_names: Sequence[str],
) -> dict[str, dict[str, float | None]]:
    lookup = _name_lookup(placed_names)
    grouped: dict[str, dict[str, float | None]] = {}
    for row in rows or ():
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        display = _resolve_rule_book_display_name(product, lookup=lookup)
        if not display:
            continue
        current = grouped.setdefault(display, {'sumOfQuantity': None, 'sumOfGross': None})
        qty = _row_qty(row)
        gross = _row_gross(row)
        if qty is not None:
            current['sumOfQuantity'] = (current['sumOfQuantity'] or 0.0) + qty
        if gross is not None:
            current['sumOfGross'] = (current['sumOfGross'] or 0.0) + gross
    return grouped


def _with_internal_as_jubilee_hills(
    pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None,
) -> dict[str, list[Mapping[str, Any]]]:
    """Jubilee Hills treats Internal / Basheerbagh as the Jubilee Hills location."""
    tree = pivots or {}
    jubilee = list(tree.get('jubileeHills') or [])
    internal = list(tree.get('internalBasheerbagh') or [])
    return {
        'jubileeHills': [*jubilee, *internal],
        'kokapet': list(tree.get('kokapet') or []),
        'internalBasheerbagh': [],
    }


def _placed_name_book(
    placed: Sequence[tuple[str, str, str | None]],
) -> dict[str, dict[str, list[str]]]:
    """Sheet product names, so MR/DC nets match those names after trim and case fold."""
    book: dict[str, dict[str, list[str]]] = {category: {} for category in CLOSING_STOCK_CATEGORIES}
    for product, category, subcategory in placed:
        book.setdefault(category, {}).setdefault(subcategory or '', []).append(product)
    return book


def _product_row(
    product: str,
    subcategory: str | None,
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]],
    transfer_qty_by_display: Mapping[str, Mapping[str, float]] | None = None,
) -> tuple[dict[str, Any], dict[str, float | None]]:
    raw = _raw_product_measures(
        product,
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        opening_by_display=opening_by_display,
        transfer_qty_by_display=transfer_qty_by_display,
    )
    return (
        {
            'kind': 'product',
            'label': product,
            'subcategory': subcategory,
            **_display_product_measures(raw),
        },
        raw,
    )


def _layouts_from_placed(
    placed: Sequence[tuple[str, str, str | None]],
    rule_book: Mapping[str, Any],
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]],
    transfer_qty_by_display: Mapping[str, Mapping[str, float]] | None = None,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[str]]]:
    """Same sheet body as Basheerbagh: a section appears only when it has products."""
    grouped: dict[tuple[str, str | None], list[str]] = {}
    for product, category, subcategory in placed:
        grouped.setdefault((category, subcategory), []).append(product)

    layouts: dict[str, list[dict[str, Any]]] = {}
    products_by_category: dict[str, list[str]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        rows: list[dict[str, Any]] = []
        flat: list[str] = []
        sheet_raw: list[dict[str, float | None]] = []
        consumed: set[str | None] = set()
        section = rule_book.get(category)

        def append_products(names: Sequence[str], subcategory: str | None) -> list[dict[str, float | None]]:
            raw_rows: list[dict[str, float | None]] = []
            for product in _sorted_product_names(names):
                row, raw = _product_row(
                    product,
                    subcategory,
                    sales_by_display=sales_by_display,
                    purchases_by_display=purchases_by_display,
                    opening_by_display=opening_by_display,
                    transfer_qty_by_display=transfer_qty_by_display,
                )
                rows.append(row)
                flat.append(product)
                raw_rows.append(raw)
                sheet_raw.append(raw)
            return raw_rows

        if category == DIAMOND_SHEET:
            for label in DIAMOND_SUBCATEGORY_ORDER:
                names = grouped.get((category, label), [])
                if not names:
                    continue
                consumed.add(label)
                rows.append({'kind': 'subcategory', 'label': label, 'subcategory': label})
                raw_rows = append_products(names, label)
                rows.append(
                    {
                        'kind': 'subcategory_total',
                        'label': subcategory_total_label(category, label),
                        'subcategory': label,
                        **_total_measures_from_raw(raw_rows),
                    }
                )
        elif category == PRECIOUS_SHEET:
            for label in PRECIOUS_SUBCATEGORY_ORDER:
                names = grouped.get((category, label), [])
                if not names:
                    continue
                consumed.add(label)
                rows.append({'kind': 'subcategory', 'label': label, 'subcategory': label})
                raw_rows = append_products(names, label)
                rows.append(
                    {
                        'kind': 'subcategory_total',
                        'label': subcategory_total_label(category, label),
                        'subcategory': label,
                        **_total_measures_from_raw(raw_rows),
                    }
                )
        elif isinstance(section, dict):
            for subcategory in section:
                label = str(subcategory).strip()
                if not label:
                    continue
                consumed.add(label)
                names = grouped.get((category, label), [])
                if not names:
                    continue
                rows.append({'kind': 'subcategory', 'label': label, 'subcategory': label})
                raw_rows = append_products(names, label)
                rows.append(
                    {
                        'kind': 'subcategory_total',
                        'label': subcategory_total_label(category, label),
                        'subcategory': label,
                        **_total_measures_from_raw(raw_rows),
                    }
                )
        else:
            names: list[str] = []
            for (sheet, _subcategory), products in grouped.items():
                if sheet == category:
                    names.extend(products)
                    consumed.add(_subcategory)
            append_products(names, None)

        extras = [
            (subcategory, names)
            for (sheet, subcategory), names in grouped.items()
            if sheet == category and subcategory not in consumed
        ]
        for subcategory, names in extras:
            if subcategory:
                rows.append({'kind': 'subcategory', 'label': subcategory, 'subcategory': subcategory})
            raw_rows = append_products(names, subcategory)
            if subcategory:
                rows.append(
                    {
                        'kind': 'subcategory_total',
                        'label': subcategory_total_label(category, subcategory),
                        'subcategory': subcategory,
                        **_total_measures_from_raw(raw_rows),
                    }
                )

        if sheet_raw:
            rows.append(
                {
                    'kind': 'grand_total',
                    'label': 'GRAND TOTAL',
                    **_total_measures_from_raw(sheet_raw),
                }
            )
        layouts[category] = rows
        products_by_category[category] = flat
    return layouts, products_by_category


def place_jubilee_hills_products(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    opening_pivot: Sequence[Mapping[str, Any]] | None = None,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
    source_average_rates: Any = None,
    receipt_rate_mappings: Any = None,
) -> dict[str, Any]:
    """
    Diamond uses the Diamond regex rules. JOS, JSP, and JSY choose Precious Stones,
    Semi Precious, and Synthetic Stones on the Precious and Semi Precious sheet.
    JEM, JPS, or JRU chooses Emerald, Pearls, or Rubie. Opening-only products use
    the previous-year sheet, except Diamond, which is assigned only by a Diamond regex.
    """
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    placed: list[tuple[str, str, str | None]] = []
    resolved: list[dict[str, str]] = []
    unmapped: list[dict[str, Any]] = []
    pending: list[str] = []
    placed_names = _IncrementalProductLookup()
    pending_names = _IncrementalProductLookup()

    def remember(product: str, location: tuple[str, str | None], source: str) -> None:
        category, subcategory = location
        placed.append((product, category, subcategory))
        placed_names.add(product)
        if source not in {'rule-book', 'product-code'}:
            resolved.append(
                {
                    'product': product,
                    'category': category,
                    'subcategory': subcategory or '',
                    'source': source,
                }
            )

    def locate_product(product: str) -> tuple[tuple[str, str | None], str] | None:
        return locate_jubilee_hills_product(product)

    for source, rows in (('Sales', sales_pivot or ()), ('Purchases', purchases_pivot or ())):
        for row in rows:
            product = str(row.get('product') or '').strip()
            if not product or _already_placed(product, placed_names.lookup):
                continue
            found = locate_product(product)
            if found is None:
                if _trading_account_product(product):
                    continue
                if not _already_placed(product, pending_names.lookup):
                    unmapped.append(
                        {
                            'product': product,
                            'source': source,
                            'sumOfQuantity': _coerce_measure(row.get('sumOfQuantity')),
                            'sumOfGross': _coerce_measure(row.get('sumOfGross')),
                        }
                    )
                    pending.append(product)
                    pending_names.add(product)
                continue
            location, origin = found
            remember(product, location, origin)

    for row in opening_pivot or ():
        product = str(row.get('product') or '').strip()
        if (
            not product
            or _already_placed(product, placed_names.lookup)
            or _already_placed(product, pending_names.lookup)
        ):
            continue
        if _opening_is_blank_or_zero(row):
            continue
        found = locate_product(product)
        if found is not None:
            location, origin = found
            remember(product, location, origin)
            continue
        if _trading_account_product(product):
            continue
        previous = _previous_year_location(row)
        if previous is not None and previous[0] != DIAMOND_SHEET:
            remember(product, previous, 'previous-year')
            continue
        unmapped.append(
            {
                'product': product,
                'source': 'Opening',
                'sumOfQuantity': _opening_qty(row),
                'sumOfGross': _coerce_measure(
                    row.get('sumOfGross') if row.get('sumOfGross') is not None else row.get('openingAmt')
                ),
            }
        )
        pending.append(product)
        pending_names.add(product)

    for source, row in iter_mr_dc_rows(mr_pivots, dc_pivots):
        product = str(row.get('product') or '').strip()
        if (
            not product
            or _already_placed(product, placed_names.lookup)
            or _already_placed(product, pending_names.lookup)
        ):
            continue
        if _trading_account_product(product):
            continue
        found = locate_product(product)
        if found is None:
            unmapped.append(
                {
                    'product': product,
                    'source': source,
                    'sumOfQuantity': _coerce_measure(row.get('sumOfQuantity')),
                    'sumOfGross': _coerce_measure(row.get('sumOfGross')),
                }
            )
            pending.append(product)
            pending_names.add(product)
            continue
        location, origin = found
        remember(product, location, origin)

    placed_names = [name for name, _category, _subcategory in placed]
    sales_by_display = _measure_map_for_placed(sales_pivot, placed_names)
    purchases_by_display = _measure_map_for_placed(purchases_pivot, placed_names)
    opening_by_display = _measure_map_for_placed(opening_pivot, placed_names)
    from app.engines.financials_engine.engine.mr_dc_closing_qty import map_mr_dc_qty_to_rule_book

    transfer_qty_by_display = map_mr_dc_qty_to_rule_book(
        mr_pivots=_with_internal_as_jubilee_hills(mr_pivots),
        dc_pivots=_with_internal_as_jubilee_hills(dc_pivots),
        rule_book=_placed_name_book(placed),
    )
    layouts, products_by_category = _layouts_from_placed(
        placed,
        book,
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        opening_by_display=opening_by_display,
        transfer_qty_by_display=transfer_qty_by_display,
    )
    from app.engines.financials_engine.engine.receipt_amounts import (
        apply_source_receipt_amounts,
    )

    receipt_amounts = apply_source_receipt_amounts(
        layouts,
        destination='jubileeHills',
        source_average_rates=source_average_rates,
        receipt_rate_mappings=receipt_rate_mappings,
    )
    return {
        'productsByCategory': products_by_category,
        'layoutByCategory': layouts,
        'unmappedProducts': [row['product'] for row in unmapped],
        'unmappedProductDetails': unmapped,
        'resolvedMappings': resolved,
        'categories': list(CLOSING_STOCK_CATEGORIES),
        'productsDisplayed': sum(len(names) for names in products_by_category.values()),
        'receiptAmountReview': receipt_amounts['receiptAmountReview'],
        'productAverageRates': receipt_amounts['productAverageRates'],
    }


def apply_jubilee_hills_placement(
    response: dict[str, Any],
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    source_average_rates: Any = None,
    receipt_rate_mappings: Any = None,
) -> dict[str, Any]:
    """Replace Basheerbagh sheet placement on a Jubilee Hills process result.

    ``sales_pivot`` and ``purchases_pivot`` are the values written onto product
    rows. When omitted, the response pivots are used. MR and DC stay separate
    and fill Receipts or Issues by location: Net Qty = MR Qty − DC Qty.
    """
    resolved_mr = mr_pivots if mr_pivots is not None else response.get('mrPivots')
    resolved_dc = dc_pivots if dc_pivots is not None else response.get('dcPivots')
    placed = place_jubilee_hills_products(
        sales_pivot=response.get('salesPivot') if sales_pivot is None else sales_pivot,
        purchases_pivot=response.get('purchasesPivot') if purchases_pivot is None else purchases_pivot,
        opening_pivot=response.get('openingPivot'),
        mr_pivots=resolved_mr,
        dc_pivots=resolved_dc,
        source_average_rates=source_average_rates,
        receipt_rate_mappings=receipt_rate_mappings,
    )
    response['mrPivots'] = _with_internal_as_jubilee_hills(resolved_mr)
    response['dcPivots'] = _with_internal_as_jubilee_hills(resolved_dc)
    response['productsByCategory'] = placed['productsByCategory']
    response['layoutByCategory'] = placed['layoutByCategory']
    response['unmappedProducts'] = placed['unmappedProducts']
    response['unmappedProductDetails'] = placed['unmappedProductDetails']
    response['resolvedMappings'] = placed['resolvedMappings']
    response['categories'] = placed['categories']
    response['receiptAmountReview'] = placed.get('receiptAmountReview') or []
    response['productAverageRates'] = placed.get('productAverageRates') or []
    summary = dict(response.get('summary') or {})
    summary['productsDisplayed'] = placed['productsDisplayed']
    summary['mappedProductCount'] = placed['productsDisplayed']
    summary['unmappedProductCount'] = len(placed['unmappedProducts'])
    response['summary'] = summary
    return response

"""Jubilee Hills opening amounts from Previous Year Financials.

Basheerbagh and Kokapet do not use this. A current product is compared only with
previous-year products in the same resolved category. An amount is filled only when
one candidate is unique and its quantity matches, or when a saved manual mapping
names that previous-year product.
"""

from __future__ import annotations

import re
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    _core_sku_key,
    _match_key,
    _norm_product,
    _resolve_closing_stock_sheet,
)
from app.engines.financials_engine.engine.jubilee_hills_placement import locate_jubilee_hills_product
from app.engines.financials_engine.engine.opening_stock import (
    collapse_same_product_rows,
    norm_opening_product_name,
)

_QTY_EPS = 1e-4
_PUNCT_RE = re.compile(r'[.\-_]+')


def _exact_key(name: str) -> str:
    text = _PUNCT_RE.sub(' ', _norm_product(name))
    return ' '.join(text.split())


def _qty_equal(left: float | None, right: float | None) -> bool:
    if left is None or right is None:
        return False
    return abs(float(left) - float(right)) <= _QTY_EPS


def _coerce_qty(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _core_key(name: str) -> str:
    """Complete code identifier. FP 1 and FP 10 stay different. Names with no number are skipped."""
    core = _core_sku_key(name)
    if not core or not any(ch.isdigit() for ch in core):
        return ''
    return core


def _token_prefix(shorter: str, longer: str) -> bool:
    left = _norm_product(shorter)
    right = _norm_product(longer)
    if not left or not right or left == right:
        return False
    return right.startswith(f'{left} ')


def _category_of(product: str, sheet_name: str | None = None) -> tuple[str | None, str | None]:
    found = locate_jubilee_hills_product(product)
    if found is not None:
        category, subcategory = found[0]
        return category, subcategory
    sheet = _resolve_closing_stock_sheet(str(sheet_name or ''))
    if sheet:
        return sheet, None
    return None, None


def _previous_year_category(product: str, sheet_name: str | None) -> tuple[str | None, str | None]:
    """Previous-year category is the sheet tab. A name code cannot move it to another sheet."""
    sheet = _resolve_closing_stock_sheet(str(sheet_name or ''))
    found = locate_jubilee_hills_product(product)
    if sheet:
        subcategory = found[0][1] if found is not None and found[0][0] == sheet else None
        return sheet, subcategory
    if found is not None:
        return found[0]
    return None, None


def _previous_rows(product_index: Mapping[str, Mapping[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for entry in product_index.values():
        product = str(entry.get('product') or '').strip()
        key = norm_opening_product_name(product)
        if not product or not key or key in seen:
            continue
        category, subcategory = _previous_year_category(
            product,
            str(entry.get('sheetName') or ''),
        )
        if not category:
            continue
        seen.add(key)
        rows.append(
            {
                'product': product,
                'category': category,
                'subcategory': subcategory,
                'closingStockQty': _coerce_qty(entry.get('closingStockQty')),
                'closingStockAmount': _coerce_qty(entry.get('closingStockAmount')),
                'exactKey': _exact_key(product),
                'alnumKey': _match_key(product),
                'coreKey': _core_key(product),
            }
        )
    return rows


def _saved_index(saved_mappings: Sequence[Mapping[str, Any]] | None) -> dict[str, list[str]]:
    index: dict[str, list[str]] = {}
    for row in saved_mappings or ():
        product = str(row.get('product') or '').strip()
        names = row.get('previousYearProducts')
        if not isinstance(names, list) or not names:
            single = str(row.get('previousYearProduct') or '').strip()
            names = [single] if single else []
        previous = [str(name or '').strip() for name in names if str(name or '').strip()]
        key = _exact_key(product) or _match_key(product)
        if key and previous:
            index[key] = previous
    return index


def _find_tier(
    pool: Sequence[dict[str, Any]],
    *,
    key_name: str,
    key: str,
) -> list[dict[str, Any]]:
    if not key:
        return []
    return [row for row in pool if row.get(key_name) == key]


def _prefix_candidates(pool: Sequence[dict[str, Any]], product: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    for row in pool:
        prev = str(row.get('product') or '')
        if _token_prefix(product, prev) or _token_prefix(prev, product):
            found.append(row)
    return found


def match_jubilee_opening_amounts(
    *,
    quantity_rows: Sequence[Mapping[str, Any]],
    previous_year_index: Mapping[str, Mapping[str, Any]],
    saved_mappings: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Match Opening Quantity rows to Previous Year amounts inside one category."""
    quantity_rows = collapse_same_product_rows(
        quantity_rows,
        sum_fields=('openingBalance',),
    )
    previous = _previous_rows(previous_year_index)
    by_category: dict[str, list[dict[str, Any]]] = {}
    for row in previous:
        by_category.setdefault(row['category'], []).append(row)
    saved = _saved_index(saved_mappings)
    claimed: set[str] = set()

    validated: list[dict[str, Any]] = []
    manual: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    counts = {
        'exactMatches': 0,
        'alphanumericMatches': 0,
        'coreCodeMatches': 0,
        'prefixMatches': 0,
        'quantityVerifiedMatches': 0,
        'savedMappingsReused': 0,
        'manualMappingRequired': 0,
        'quantityMismatches': 0,
        'multipleCandidateMatches': 0,
        'unresolvedProducts': 0,
    }
    seen: set[str] = set()

    def _options(category: str) -> list[dict[str, Any]]:
        return [
            {
                'product': row['product'],
                'category': category,
                'closingStockQty': row['closingStockQty'],
                'closingStockAmount': row['closingStockAmount'],
            }
            for row in by_category.get(category, [])
        ]

    def _accept(
        product: str,
        *,
        category: str,
        subcategory: str | None,
        opening_qty: float | None,
        previous_row: dict[str, Any],
        method: str,
    ) -> None:
        claimed.add(norm_opening_product_name(previous_row['product']))
        validated.append(
            {
                'product': product,
                'openingQty': opening_qty,
                'openingAmt': previous_row.get('closingStockAmount'),
                'category': category,
                'subcategory': subcategory,
                'status': 'matched_saved' if method == 'saved' else 'matched',
                'matchMethod': method,
                'previousYearProduct': previous_row['product'],
                'previousClosingQty': previous_row.get('closingStockQty'),
                'sheetName': category,
            }
        )
        if method == 'saved':
            counts['savedMappingsReused'] += 1
        elif method == 'exact':
            counts['exactMatches'] += 1
            counts['quantityVerifiedMatches'] += 1
        elif method == 'alphanumeric':
            counts['alphanumericMatches'] += 1
            counts['quantityVerifiedMatches'] += 1
        elif method == 'core':
            counts['coreCodeMatches'] += 1
            counts['quantityVerifiedMatches'] += 1
        elif method == 'prefix':
            counts['prefixMatches'] += 1
            counts['quantityVerifiedMatches'] += 1

    def _manual(
        product: str,
        *,
        category: str | None,
        subcategory: str | None,
        opening_qty: float | None,
        reason: str,
        suggested: Sequence[dict[str, Any]] | None = None,
    ) -> None:
        counts['manualMappingRequired'] += 1
        counts['unresolvedProducts'] += 1
        if reason == 'quantity_mismatch':
            counts['quantityMismatches'] += 1
        elif reason == 'multiple_candidates':
            counts['multipleCandidateMatches'] += 1
        row = {
            'product': product,
            'category': category,
            'subcategory': subcategory,
            'openingQty': opening_qty,
            'openingAmt': None,
            'status': 'manual_mapping_required',
            'reason': reason,
            'sheetName': category,
            'candidateProducts': _options(category) if category else [],
            'suggestedProducts': [
                {
                    'product': item['product'],
                    'closingStockQty': item.get('closingStockQty'),
                    'closingStockAmount': item.get('closingStockAmount'),
                }
                for item in (suggested or ())
            ],
        }
        manual.append(row)
        unresolved.append({'product': product, 'category': category, 'reason': reason})
        validated.append(row)

    for qty_row in quantity_rows:
        product = str(qty_row.get('product') or '').strip()
        identity = norm_opening_product_name(product)
        if not product or not identity or identity in seen:
            continue
        seen.add(identity)
        opening_qty = _coerce_qty(qty_row.get('openingBalance'))
        category, subcategory = _category_of(product)
        if not category:
            _manual(
                product,
                category=None,
                subcategory=None,
                opening_qty=opening_qty,
                reason='category_not_resolved',
            )
            continue

        pool = [
            row
            for row in by_category.get(category, [])
            if norm_opening_product_name(row['product']) not in claimed
        ]
        saved_names = saved.get(_exact_key(product)) or saved.get(_match_key(product)) or []
        if saved_names:
            saved_rows: list[dict[str, Any]] = []
            for saved_name in saved_names:
                saved_key = norm_opening_product_name(saved_name)
                saved_row = next(
                    (
                        row
                        for row in pool
                        if norm_opening_product_name(row['product']) == saved_key
                        or _match_key(row['product']) == _match_key(saved_name)
                    ),
                    None,
                )
                if saved_row is not None and saved_row not in saved_rows:
                    saved_rows.append(saved_row)
            if saved_rows and len(saved_rows) == len(saved_names):
                amount = sum(_coerce_qty(row.get('closingStockAmount')) or 0 for row in saved_rows)
                quantity = sum(_coerce_qty(row.get('closingStockQty')) or 0 for row in saved_rows)
                for row in saved_rows:
                    claimed.add(norm_opening_product_name(row['product']))
                _accept(
                    product,
                    category=category,
                    subcategory=subcategory,
                    opening_qty=opening_qty,
                    previous_row={
                        'product': ' + '.join(row['product'] for row in saved_rows),
                        'closingStockAmount': amount,
                        'closingStockQty': quantity,
                    },
                    method='saved',
                )
                continue

        tiers = (
            ('exact', _find_tier(pool, key_name='exactKey', key=_exact_key(product))),
            ('alphanumeric', _find_tier(pool, key_name='alnumKey', key=_match_key(product))),
            ('core', _find_tier(pool, key_name='coreKey', key=_core_key(product))),
            ('prefix', _prefix_candidates(pool, product)),
        )
        chosen_method = ''
        chosen: list[dict[str, Any]] = []
        for method, hits in tiers:
            if hits:
                chosen_method = method
                chosen = hits
                break

        if not chosen:
            _manual(
                product,
                category=category,
                subcategory=subcategory,
                opening_qty=opening_qty,
                reason='no_candidate',
            )
            continue
        if len(chosen) != 1:
            _manual(
                product,
                category=category,
                subcategory=subcategory,
                opening_qty=opening_qty,
                reason='multiple_candidates',
                suggested=chosen,
            )
            continue
        winner = chosen[0]
        if not _qty_equal(opening_qty, winner.get('closingStockQty')):
            _manual(
                product,
                category=category,
                subcategory=subcategory,
                opening_qty=opening_qty,
                reason='quantity_mismatch',
                suggested=[winner],
            )
            continue
        _accept(
            product,
            category=category,
            subcategory=subcategory,
            opening_qty=opening_qty,
            previous_row=winner,
            method=chosen_method,
        )

    opening_pivot = [
        {
            'product': row['product'],
            'ruleBookProduct': row['product'],
            'category': row.get('category'),
            'subcategory': row.get('subcategory'),
            'sheetName': row.get('sheetName'),
            'status': row.get('status'),
            'matchMethod': row.get('matchMethod'),
            'previousYearProduct': row.get('previousYearProduct'),
            'sumOfQuantity': row.get('openingQty'),
            'sumOfGross': row.get('openingAmt'),
        }
        for row in validated
        if row.get('openingQty') is not None or row.get('openingAmt') is not None
    ]
    previous_year_by_category = {
        category: _options(category) for category in by_category
    }
    summary = {
        **counts,
        'manualMappingRequiredRows': manual,
        'unresolvedProducts': unresolved,
        'unresolvedProductCount': len(unresolved),
        'previousYearByCategory': previous_year_by_category,
    }
    report = {
        'exactMatchedCount': counts['exactMatches'] + counts['alphanumericMatches'],
        'coreCodeMatchedCount': counts['coreCodeMatches'],
        'prefixMatchedCount': counts['prefixMatches'],
        'quantityVerifiedCount': counts['quantityVerifiedMatches'],
        'savedMappingsReused': counts['savedMappingsReused'],
        'fallbackMatchedCount': counts['coreCodeMatches'] + counts['prefixMatches'],
        'matchedCount': counts['quantityVerifiedMatches'] + counts['savedMappingsReused'],
        'manualMappingRequired': manual,
        'manualMappingRequiredCount': counts['manualMappingRequired'],
        'quantityMismatchCount': counts['quantityMismatches'],
        'multipleCandidateCount': counts['multipleCandidateMatches'],
        'unmatched': [
            row for row in manual if row.get('reason') == 'no_candidate'
        ],
        'unmatchedCount': sum(1 for row in manual if row.get('reason') == 'no_candidate'),
        'unresolvedProducts': unresolved,
        'unresolvedProductCount': len(unresolved),
    }
    return {
        'validatedOpening': validated,
        'openingPivot': opening_pivot,
        'report': report,
        'match': summary,
    }

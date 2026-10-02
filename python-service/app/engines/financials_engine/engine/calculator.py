"""Product-wise SUM(Quantity) and SUM(Gross Amount) pivot."""

from __future__ import annotations

from collections import OrderedDict
from typing import Any


def _round_amount(value: float) -> float:
    return round(float(value), 4)


def build_product_pivot(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Group rows by Product and sum Quantity and Gross Amount independently.

    Blank product names are skipped. First-seen product text is preserved.
    Each product appears once.
    """
    buckets: OrderedDict[str, dict[str, Any]] = OrderedDict()

    for row in rows:
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        if product not in buckets:
            buckets[product] = {
                'product': product,
                'sumOfQuantity': 0.0,
                'sumOfGross': 0.0,
                'category': str(row.get('category') or '').strip() or None,
                'subcategory': str(row.get('subcategory') or '').strip() or None,
            }
        else:
            if not buckets[product]['category']:
                category = str(row.get('category') or '').strip()
                if category:
                    buckets[product]['category'] = category
            if not buckets[product]['subcategory']:
                subcategory = str(row.get('subcategory') or '').strip()
                if subcategory:
                    buckets[product]['subcategory'] = subcategory
        buckets[product]['sumOfQuantity'] += float(row.get('quantity') or 0)
        buckets[product]['sumOfGross'] += float(row.get('grossAmount') or 0)

    result: list[dict[str, Any]] = []
    for item in buckets.values():
        entry: dict[str, Any] = {
            'product': item['product'],
            'sumOfQuantity': _round_amount(item['sumOfQuantity']),
            'sumOfGross': _round_amount(item['sumOfGross']),
        }
        if item['category']:
            entry['category'] = item['category']
        if item['subcategory']:
            entry['subcategory'] = item['subcategory']
        result.append(entry)
    return result


def _product_lookup_keys(name: str) -> list[tuple[str, str]]:
    from app.engines.financials_engine.config.product_rule_book import (
        _core_sku_key,
        _match_key,
        _norm_product,
    )

    product = str(name or '').strip()
    keys: list[tuple[str, str]] = []
    norm = _norm_product(product)
    if norm:
        keys.append(('norm', norm))
    alpha = _match_key(product)
    if alpha:
        keys.append(('alpha', alpha))
    core = _core_sku_key(product)
    if core:
        keys.append(('core', core))
    return keys


def _index_adjustment_rows(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict, set[str]]:
    entries: list[dict[str, Any]] = []
    key_to_indexes: dict[tuple[str, str], list[int]] = {}
    for row in rows:
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        index = len(entries)
        entries.append(
            {
                'qty': float(row.get('sumOfQuantity') or 0),
                'amt': float(row.get('sumOfGross') or 0),
                'used': False,
            }
        )
        for kind, key in _product_lookup_keys(product):
            key_to_indexes.setdefault((kind, key), []).append(index)
    ambiguous_cores = {
        key
        for (kind, key), indexes in key_to_indexes.items()
        if kind == 'core' and len(set(indexes)) > 1
    }
    return entries, key_to_indexes, ambiguous_cores


def _matching_adjustment_index(
    product: str,
    entries: list[dict[str, Any]],
    key_to_indexes: dict,
    ambiguous_cores: set[str],
) -> int | None:
    for kind, key in _product_lookup_keys(product):
        if kind == 'core' and key in ambiguous_cores:
            continue
        for index in key_to_indexes.get((kind, key), []):
            if not entries[index]['used']:
                return index
    return None


def apply_same_product_adjustment(
    base_rows: list[dict[str, Any]],
    signed_pivots: list[tuple[list[dict[str, Any]], float]],
) -> list[dict[str, Any]]:
    """Adjust Sales or Purchases only when the same product is on an adjustment pivot.

    A product that appears only on a return, credit note, or debit note is left off.
    """
    indexes = [_index_adjustment_rows(rows) for rows, _sign in signed_pivots]
    adjusted: list[dict[str, Any]] = []
    for row in base_rows:
        item = dict(row)
        qty = float(item.get('sumOfQuantity') or 0)
        amt = float(item.get('sumOfGross') or 0)
        product = str(item.get('product') or '')
        for (entries, key_map, ambiguous_cores), (_rows, sign) in zip(indexes, signed_pivots):
            match = _matching_adjustment_index(product, entries, key_map, ambiguous_cores)
            if match is None:
                continue
            entries[match]['used'] = True
            qty += float(sign) * float(entries[match]['qty'])
            amt += float(sign) * float(entries[match]['amt'])
        item['sumOfQuantity'] = _round_amount(qty)
        item['sumOfGross'] = _round_amount(amt)
        adjusted.append(item)
    return adjusted

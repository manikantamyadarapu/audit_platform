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

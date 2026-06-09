from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.sales_engine.config.loader import (
    clear_metal_rate_caches,
    diamond_editable_product_keys,
    load_diamond_rate_rule_book,
)
from app.utils.normalization_engine import normalize_strict_text

_CONFIG_DIR = Path(__file__).resolve().parents[1] / 'config'
_RULE_BOOK_PATH = _CONFIG_DIR / 'diamond_rate_rule_book.json'


def _parse_optional_rate(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return None
    return rate if rate >= 0 else None


def _editable_sort_key(name: str) -> tuple[int, str]:
    upper = name.upper()
    if upper == 'CHAKRI':
        return (0, name)
    if upper == 'CUSTOMER FLAT POLKI':
        return (1, name)
    if upper == 'POLKI A':
        return (2, name)
    if upper.startswith('FLAT POLKI FP'):
        return (3, name)
    if 'LOOSE DI. RA' in upper:
        return (4, name)
    if upper.startswith('DI. RC'):
        return (5, name)
    return (6, name)


def ordered_editable_product_names() -> list[str]:
    names = list(diamond_editable_product_keys())
    names.sort(key=_editable_sort_key)
    return names


def load_rule_book() -> dict[str, Any]:
    if not _RULE_BOOK_PATH.exists():
        return _empty_rule_book()
    return json.loads(_RULE_BOOK_PATH.read_text(encoding='utf-8'))


def _empty_rule_book() -> dict[str, Any]:
    return {
        'uplift_percent': 25,
        'deviation_percent': 30,
        'products': {},
        'updated_at': None,
    }


def save_rule_book(payload: dict[str, Any]) -> dict[str, Any]:
    """Persist Type 1 (editable) min/max only; hardcoded sheet ranges are unchanged."""
    current = load_diamond_rate_rule_book()
    products_in = payload.get('products') if isinstance(payload.get('products'), dict) else {}
    editable = diamond_editable_product_keys()

    products_out: dict[str, dict[str, float | None]] = {}
    for product_key in ordered_editable_product_names():
        incoming = products_in.get(product_key)
        if not isinstance(incoming, dict):
            incoming = products_in.get(normalize_strict_text(product_key))
        if isinstance(incoming, dict):
            products_out[product_key] = {
                'min_rate': _parse_optional_rate(incoming.get('min_rate')),
                'max_rate': _parse_optional_rate(incoming.get('max_rate')),
            }
        else:
            existing = (current.get('products') or {}).get(product_key) or {}
            products_out[product_key] = {
                'min_rate': _parse_optional_rate(existing.get('min_rate')),
                'max_rate': _parse_optional_rate(existing.get('max_rate')),
            }

    for raw_key, spec in products_in.items():
        norm = normalize_strict_text(raw_key)
        if norm not in editable or norm in products_out or not isinstance(spec, dict):
            continue
        products_out[norm] = {
            'min_rate': _parse_optional_rate(spec.get('min_rate')),
            'max_rate': _parse_optional_rate(spec.get('max_rate')),
        }

    stored = {
        'uplift_percent': int(payload.get('uplift_percent') or current.get('uplift_percent') or 25),
        'deviation_percent': int(
            payload.get('deviation_percent') or current.get('deviation_percent') or 30
        ),
        'products': products_out,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    _RULE_BOOK_PATH.write_text(json.dumps(stored, indent=2), encoding='utf-8')
    clear_metal_rate_caches()
    return api_response_from_stored(stored)


def api_response_from_stored(stored: dict[str, Any]) -> dict[str, Any]:
    """API exposes editable Rule Book products only (not hardcoded sheet SKUs)."""
    products: dict[str, dict[str, float | None]] = {}
    raw = stored.get('products') or {}
    for name in ordered_editable_product_names():
        spec = raw.get(name) or {}
        products[name] = {
            'min_rate': spec.get('min_rate'),
            'max_rate': spec.get('max_rate'),
        }
    return {
        'products': products,
        'uplift_percent': stored.get('uplift_percent', 25),
        'deviation_percent': stored.get('deviation_percent', 30),
        'updated_at': stored.get('updated_at'),
    }

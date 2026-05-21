from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.sales_engine.config.loader import (
    METAL_RATE_RULE_BOOK_PRODUCTS,
    clear_metal_rate_caches,
    load_metal_rate_rule_book_config,
)
from app.utils.normalization_engine import normalize_strict_text

_CONFIG_DIR = Path(__file__).resolve().parents[1] / 'config'
_RULE_BOOK_PATH = _CONFIG_DIR / 'metal_rate_rule_book.json'


def _parse_optional_rate(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return None
    return rate if rate > 0 else None


def load_rule_book() -> dict[str, Any]:
    if not _RULE_BOOK_PATH.exists():
        return _empty_rule_book()
    return json.loads(_RULE_BOOK_PATH.read_text(encoding='utf-8'))


def _empty_rule_book() -> dict[str, Any]:
    return {
        **{product: None for product in METAL_RATE_RULE_BOOK_PRODUCTS},
        'allowed_variation_percent': 30,
        'updated_at': None,
    }


def save_rule_book(payload: dict[str, Any]) -> dict[str, Any]:
    """Persist employee-entered product rates for gold/silver rule book validation."""
    rates_in = payload.get('rates') if isinstance(payload.get('rates'), dict) else payload
    product_rates: dict[str, float | None] = {}
    for product in METAL_RATE_RULE_BOOK_PRODUCTS:
        raw = rates_in.get(product) if isinstance(rates_in, dict) else payload.get(product)
        product_rates[product] = _parse_optional_rate(raw)

    stored = {
        **product_rates,
        'allowed_variation_percent': int(
            payload.get('allowed_variation_percent')
            or load_metal_rate_rule_book_config().get('allowed_variation_percent')
            or 30
        ),
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    _RULE_BOOK_PATH.write_text(json.dumps(stored, indent=2), encoding='utf-8')
    clear_metal_rate_caches()
    return api_response_from_stored(stored)


def api_response_from_stored(stored: dict[str, Any]) -> dict[str, Any]:
    rates = {product: stored.get(product) for product in METAL_RATE_RULE_BOOK_PRODUCTS}
    return {
        'rates': rates,
        'allowed_variation_percent': stored.get('allowed_variation_percent', 30),
        'updated_at': stored.get('updated_at'),
    }


# Backwards-compatible aliases for rate-rules router
load_market_rates = load_rule_book
save_market_rates = save_rule_book

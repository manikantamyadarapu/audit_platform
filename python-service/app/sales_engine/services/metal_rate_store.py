from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.sales_engine.config.loader import clear_metal_rate_caches
from app.utils.normalization_engine import normalize_strict_text

_CONFIG_DIR = Path(__file__).resolve().parents[1] / 'config'
_MARKET_RATES_PATH = _CONFIG_DIR / 'metal_market_rates.json'

_GOLD_FIELD_TO_ACCOUNT: dict[str, str] = {
    'gold_14k_rate': 'GOLD SALES ACCOUNT - 14K',
    'gold_18k_rate': 'GOLD SALES ACCOUNT - 18K',
    'gold_22k_rate': 'GOLD SALES ACCOUNT - 22K',
    'gold_jadau_rate': 'GOLD SALES ACCOUNT - JADAU',
    'gold_24k_rate': 'GOLD SALES ACCOUNT - 24K',
}


def _parse_optional_rate(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        rate = float(value)
    except (TypeError, ValueError):
        return None
    return rate if rate > 0 else None


def load_market_rates() -> dict[str, Any]:
    if not _MARKET_RATES_PATH.exists():
        return {
            'allowed_variation_percent': 30,
            'gold_account_standard_rates': {},
            'silver_account_standard_rate': None,
            'updated_at': None,
        }
    return json.loads(_MARKET_RATES_PATH.read_text(encoding='utf-8'))


def save_market_rates(payload: dict[str, Any]) -> dict[str, Any]:
    """Persist employee-entered gold/silver market rates for sales audit."""
    gold_rates: dict[str, float | None] = {}
    for field, account in _GOLD_FIELD_TO_ACCOUNT.items():
        key = normalize_strict_text(account)
        gold_rates[key] = _parse_optional_rate(payload.get(field))

    silver_rate = _parse_optional_rate(payload.get('silver_rate'))
    stored = {
        'allowed_variation_percent': 30,
        'gold_account_standard_rates': gold_rates,
        'silver_account_standard_rate': silver_rate,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    _MARKET_RATES_PATH.write_text(
        json.dumps(stored, indent=2),
        encoding='utf-8',
    )
    clear_metal_rate_caches()
    return api_response_from_stored(stored)


def api_response_from_stored(stored: dict[str, Any]) -> dict[str, Any]:
    gold = stored.get('gold_account_standard_rates') or {}

    def _gold_rate(account: str) -> float | None:
        return gold.get(normalize_strict_text(account))

    return {
        'gold_14k_rate': _gold_rate('GOLD SALES ACCOUNT - 14K'),
        'gold_18k_rate': _gold_rate('GOLD SALES ACCOUNT - 18K'),
        'gold_22k_rate': _gold_rate('GOLD SALES ACCOUNT - 22K'),
        'gold_jadau_rate': _gold_rate('GOLD SALES ACCOUNT - JADAU'),
        'gold_24k_rate': _gold_rate('GOLD SALES ACCOUNT - 24K'),
        'silver_rate': stored.get('silver_account_standard_rate'),
        'allowed_variation_percent': stored.get('allowed_variation_percent', 30),
        'updated_at': stored.get('updated_at'),
    }

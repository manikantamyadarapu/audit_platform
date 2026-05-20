from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from app.utils.normalization_engine import normalize_strict_text

_CONFIG_DIR = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def load_mappings_config() -> dict:
    return json.loads((_CONFIG_DIR / 'mappings.json').read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def load_sales_ledger_catalog() -> dict:
    return json.loads((_CONFIG_DIR / 'sales_ledger_catalog.json').read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def load_gemstone_config() -> dict:
    return json.loads((_CONFIG_DIR / 'gemstone_rules.json').read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def sales_account_aliases() -> dict[str, str]:
    """Normalized alias → canonical account (matches __sales_account_norm)."""
    catalog = load_sales_ledger_catalog().get('sales_account_aliases') or {}
    legacy = load_mappings_config().get('sales_account_aliases') or {}
    merged = {str(k): str(v) for k, v in legacy.items()}
    merged.update({str(k): str(v) for k, v in catalog.items()})
    normalized: dict[str, str] = {}
    for alias, target in merged.items():
        key = normalize_strict_text(alias)
        value = normalize_strict_text(target)
        if key and value:
            normalized[key] = value
    return normalized


@lru_cache(maxsize=1)
def account_product_rules() -> dict[str, dict[str, tuple[str, ...]]]:
    raw = load_sales_ledger_catalog().get('account_product_rules') or {}
    rules: dict[str, dict[str, tuple[str, ...]]] = {}
    for account, spec in raw.items():
        rules[str(account)] = {
            'patterns': tuple(spec.get('patterns') or []),
            'exact': tuple(spec.get('exact') or []),
        }
    return rules


@lru_cache(maxsize=1)
def account_product_prefixes() -> dict[str, tuple[str, ...]]:
    """Legacy prefixes kept for backwards-compatible imports."""
    raw = load_mappings_config().get('account_product_prefixes') or {}
    return {account: tuple(prefixes) for account, prefixes in raw.items()}


@lru_cache(maxsize=1)
def known_sales_accounts() -> frozenset[str]:
    return frozenset(account_product_rules().keys())


@lru_cache(maxsize=1)
def slab_route_order() -> tuple[str, ...]:
    return tuple(load_mappings_config().get('slab_route_order') or ())


@lru_cache(maxsize=1)
def slab_route_patterns() -> dict[str, str]:
    return dict(load_mappings_config().get('slab_route_patterns') or {})


@lru_cache(maxsize=1)
def misc_product_patterns() -> tuple[str, ...]:
    return tuple(load_mappings_config().get('misc_product_patterns') or ())


@lru_cache(maxsize=1)
def rate_validation_families() -> frozenset[str]:
    return frozenset(load_gemstone_config().get('rate_validation_families') or ())


@lru_cache(maxsize=1)
def deviation_fraction() -> float:
    pct = float(load_gemstone_config().get('deviation_percent', 30))
    return pct / 100.0


@lru_cache(maxsize=1)
def load_metal_account_rates_config() -> dict:
    path = _CONFIG_DIR / 'metal_account_rates.json'
    return json.loads(path.read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def load_metal_market_rates_config() -> dict:
    path = _CONFIG_DIR / 'metal_market_rates.json'
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding='utf-8'))


def clear_metal_rate_caches() -> None:
    load_metal_market_rates_config.cache_clear()
    gold_account_standard_rates.cache_clear()
    silver_account_standard_rate.cache_clear()
    metal_deviation_fraction.cache_clear()


@lru_cache(maxsize=1)
def metal_deviation_fraction() -> float:
    market = load_metal_market_rates_config()
    template = load_metal_account_rates_config()
    pct = float(
        market.get('allowed_variation_percent')
        or template.get('allowed_variation_percent')
        or 30
    )
    return pct / 100.0


@lru_cache(maxsize=1)
def gold_account_standard_rates() -> dict[str, float | None]:
    template = load_metal_account_rates_config().get('gold_account_standard_rates') or {}
    market = load_metal_market_rates_config().get('gold_account_standard_rates') or {}
    merged_keys = {normalize_strict_text(str(k)) for k in template} | {
        normalize_strict_text(str(k)) for k in market
    }
    rates: dict[str, float | None] = {}
    for key in merged_keys:
        if not key:
            continue
        value = market.get(key, template.get(key))
        if value is None:
            rates[key] = None
        else:
            rates[key] = float(value)
    return rates


@lru_cache(maxsize=1)
def silver_account_standard_rate() -> float | None:
    market = load_metal_market_rates_config()
    template = load_metal_account_rates_config()
    value = market.get('silver_account_standard_rate')
    if value is None:
        value = template.get('silver_account_standard_rate')
    if value is None:
        return None
    return float(value)


@lru_cache(maxsize=1)
def metal_rate_product_patterns() -> tuple[tuple[str, tuple[str, ...]], ...]:
    cfg = load_metal_account_rates_config()
    return (
        ('GOLD', tuple(cfg.get('gold_rate_product_patterns') or ())),
        ('SILVER', tuple(cfg.get('silver_rate_product_patterns') or ())),
    )


@lru_cache(maxsize=1)
def metal_rate_skip_product_patterns() -> tuple[str, ...]:
    return tuple(load_metal_account_rates_config().get('metal_rate_skip_product_patterns') or ())


def catalog_accounts_and_patterns() -> list[tuple[str, tuple[str, ...]]]:
    """Account keys with all regex patterns (exact entries compiled as anchored patterns)."""
    rows: list[tuple[str, tuple[str, ...]]] = []
    for account, spec in account_product_rules().items():
        patterns = list(spec.get('patterns') or ())
        for exact in spec.get('exact') or ():
            patterns.append(f'^{exact}$')
        rows.append((account, tuple(patterns)))
    return rows

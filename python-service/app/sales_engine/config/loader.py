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
def load_gemstone_product_catalog() -> dict:
    """Authoritative gemstone SKU lists (slab price is encoded in the product name)."""
    path = _CONFIG_DIR / 'gemstone_product_catalog.json'
    if not path.exists():
        return {'accounts': {}}
    return json.loads(path.read_text(encoding='utf-8'))


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


METAL_RATE_RULE_BOOK_PRODUCTS: tuple[str, ...] = (
    'Gold Ornaments 14K',
    'Gold Ornaments 18K',
    'Customer Gold Ornaments 18K',
    'Customer Gold Ornaments 22K',
    'Gold Ornaments 22K',
    'Gold Ornaments Jadau',
    'Standard Gold 24K',
    'Silver articles',
)


@lru_cache(maxsize=1)
def load_metal_rate_rule_book_config() -> dict:
    path = _CONFIG_DIR / 'metal_rate_rule_book.json'
    if not path.exists():
        return {'allowed_variation_percent': 30}
    return json.loads(path.read_text(encoding='utf-8'))


def _diamond_band_values(
    base_min: float,
    base_max: float,
    *,
    uplift_percent: float,
    deviation_percent: float,
) -> dict[str, float]:
    uplift = uplift_percent / 100.0
    deviation = deviation_percent / 100.0
    adjusted_min = base_min + (base_min * uplift)
    adjusted_max = base_max + (base_max * uplift)
    final_min = adjusted_min - (adjusted_min * deviation)
    final_max = adjusted_max + (adjusted_max * deviation)
    return {
        'base_min': base_min,
        'base_max': base_max,
        'adjusted_min': adjusted_min,
        'adjusted_max': adjusted_max,
        'final_min': final_min,
        'final_max': final_max,
    }


@lru_cache(maxsize=1)
def load_diamond_rate_rule_book() -> dict:
    """Employee-editable ranges (Type 1) saved from the frontend Rule Book."""
    path = _CONFIG_DIR / 'diamond_rate_rule_book.json'
    if not path.exists():
        return {'uplift_percent': 25, 'deviation_percent': 30, 'products': {}}
    return json.loads(path.read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def load_diamond_hardcoded_rates() -> dict:
    """Sheet-backed ranges (Type 2) — not edited in the Rule Book UI."""
    path = _CONFIG_DIR / 'diamond_hardcoded_rates.json'
    if not path.exists():
        return {'products': {}}
    return json.loads(path.read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def diamond_editable_product_keys() -> frozenset[str]:
    """Normalized product names that use the frontend Rule Book."""
    path = _CONFIG_DIR / 'diamond_editable_products.json'
    if not path.exists():
        return frozenset()
    raw = json.loads(path.read_text(encoding='utf-8')).get('products') or []
    return frozenset(normalize_strict_text(k) for k in raw if normalize_strict_text(k))


def _parse_diamond_product_specs(raw_products: dict) -> dict[str, dict[str, float | None]]:
    entries: dict[str, dict[str, float | None]] = {}
    for product_key, spec in raw_products.items():
        norm = normalize_strict_text(product_key)
        if not norm or not isinstance(spec, dict):
            continue
        min_raw = spec.get('min_rate')
        max_raw = spec.get('max_rate')
        entries[norm] = {
            'min_rate': None if min_raw is None else float(min_raw),
            'max_rate': None if max_raw is None else float(max_raw),
        }
    return entries


@lru_cache(maxsize=1)
def diamond_rule_book_entries() -> dict[str, dict[str, float | None]]:
    """
    Merged Type 1 (Rule Book JSON) + Type 2 (hardcoded JSON).
    Rule Book values override hardcoded keys for editable SKUs only.
    """
    merged = _parse_diamond_product_specs(load_diamond_hardcoded_rates().get('products') or {})
    editable = diamond_editable_product_keys()
    rule_book = _parse_diamond_product_specs(load_diamond_rate_rule_book().get('products') or {})
    for norm, spec in rule_book.items():
        if norm in editable:
            merged[norm] = spec
    return merged


@lru_cache(maxsize=1)
def diamond_final_bands_by_product() -> dict[str, dict[str, float]]:
    """Normalized product name -> precomputed bands (configured SKUs only)."""
    cfg = load_diamond_rate_rule_book()
    uplift = float(cfg.get('uplift_percent', 25))
    deviation = float(cfg.get('deviation_percent', 30))
    bands: dict[str, dict[str, float]] = {}
    for norm, spec in diamond_rule_book_entries().items():
        base_min = spec.get('min_rate')
        base_max = spec.get('max_rate')
        if base_min is None or base_max is None:
            continue
        bands[norm] = _diamond_band_values(
            base_min,
            base_max,
            uplift_percent=uplift,
            deviation_percent=deviation,
        )
    return bands


def clear_metal_rate_caches() -> None:
    load_metal_rate_rule_book_config.cache_clear()
    product_rule_book_rates.cache_clear()
    metal_deviation_fraction.cache_clear()
    load_diamond_rate_rule_book.cache_clear()
    load_diamond_hardcoded_rates.cache_clear()
    diamond_editable_product_keys.cache_clear()
    diamond_rule_book_entries.cache_clear()
    diamond_final_bands_by_product.cache_clear()


@lru_cache(maxsize=1)
def metal_deviation_fraction() -> float:
    pct = float(load_metal_rate_rule_book_config().get('allowed_variation_percent', 30))
    return pct / 100.0


@lru_cache(maxsize=1)
def product_rule_book_rates() -> dict[str, float | None]:
    """Normalized product name → entered rate (null when not configured)."""
    cfg = load_metal_rate_rule_book_config()
    rates: dict[str, float | None] = {}
    for product in METAL_RATE_RULE_BOOK_PRODUCTS:
        norm = normalize_strict_text(product)
        if not norm:
            continue
        raw = cfg.get(product, cfg.get(norm))
        if raw is None:
            rates[norm] = None
        else:
            rates[norm] = float(raw)
    return rates


def catalog_accounts_and_patterns() -> list[tuple[str, tuple[str, ...]]]:
    """Account keys with all regex patterns (exact entries compiled as anchored patterns)."""
    rows: list[tuple[str, tuple[str, ...]]] = []
    for account, spec in account_product_rules().items():
        patterns = list(spec.get('patterns') or ())
        for exact in spec.get('exact') or ():
            patterns.append(f'^{exact}$')
        rows.append((account, tuple(patterns)))
    return rows

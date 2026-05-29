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
def load_uom_rules_config() -> dict:
    path = _CONFIG_DIR / 'uom_rules.json'
    if not path.exists():
        return {'grams_products': list(METAL_RATE_RULE_BOOK_PRODUCTS) + ['Black beads', 'Dori', 'Lac', 'Wax, Dori Etc', 'Pearls']}
    return json.loads(path.read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def grams_product_norms() -> frozenset[str]:
    raw = load_uom_rules_config().get('grams_products') or []
    return frozenset(normalize_strict_text(name) for name in raw if normalize_strict_text(name))


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
    """DEPRECATED: All diamond rates are now hardcoded. Returns empty config."""
    return {'uplift_percent': 25, 'deviation_percent': 15, 'products': {}}


@lru_cache(maxsize=1)
def load_diamond_hardcoded_rates() -> dict:
    """Sheet-backed ranges (Type 2) — not edited in the Rule Book UI."""
    path = _CONFIG_DIR / 'diamond_hardcoded_rates.json'
    if not path.exists():
        return {'products': {}}
    return json.loads(path.read_text(encoding='utf-8'))


@lru_cache(maxsize=1)
def diamond_editable_product_keys() -> frozenset[str]:
    """DEPRECATED: Returns empty set. All diamonds are hardcoded."""
    return frozenset()


def _parse_diamond_product_specs(raw_products: dict) -> dict[str, dict[str, float | bool | None]]:
    entries: dict[str, dict[str, float | bool | None]] = {}
    for product_key, spec in raw_products.items():
        norm = normalize_strict_text(product_key)
        if not norm or not isinstance(spec, dict):
            continue
        min_raw = spec.get('min_rate')
        max_raw = spec.get('max_rate')
        entries[norm] = {
            'min_rate': None if min_raw is None else float(min_raw),
            'max_rate': None if max_raw is None else float(max_raw),
            'min_only': bool(spec.get('min_only', False)),
        }
    return entries


@lru_cache(maxsize=1)
def diamond_rule_book_entries() -> dict[str, dict[str, float | bool | None]]:
    """
    All diamond rates are hardcoded. Returns hardcoded product specs only.
    Rule Book and editable products are deprecated.
    """
    return _parse_diamond_product_specs(load_diamond_hardcoded_rates().get('products') or {})


@lru_cache(maxsize=1)
def diamond_final_bands_by_product() -> dict[str, dict[str, float | bool | None]]:
    """
    Normalized product name -> precomputed bands (configured SKUs only).
    All diamonds use hardcoded rates with +25% uplift then ±15% deviation.
    """
    uplift = 25.0  # Fixed uplift percentage
    deviation = 15.0  # Fixed deviation percentage (±15%)
    bands: dict[str, dict[str, float | bool | None]] = {}
    for norm, spec in diamond_rule_book_entries().items():
        base_min = spec.get('min_rate')
        base_max = spec.get('max_rate')
        min_only = bool(spec.get('min_only', False))
        if base_min is None:
            continue
        if min_only:
            bands[norm] = {
                'base_min': base_min,
                'base_max': None,
                'final_min': base_min,
                'final_max': None,
                'min_only': True,
            }
            continue
        if base_max is None:
            continue
        band = _diamond_band_values(
            base_min,
            base_max,
            uplift_percent=uplift,
            deviation_percent=deviation,
        )
        band['min_only'] = False
        bands[norm] = band
    return bands


def _parse_metal_rate_entry(raw: object) -> dict[str, float | None]:
    """Single legacy rate or {min_rate, max_rate} object."""
    if isinstance(raw, dict):
        min_raw = raw.get('min_rate')
        max_raw = raw.get('max_rate')
        min_rate = None if min_raw is None else float(min_raw)
        max_rate = None if max_raw is None else float(max_raw)
        return {'min_rate': min_rate, 'max_rate': max_rate}
    if raw is None or raw == '':
        return {'min_rate': None, 'max_rate': None}
    try:
        rate = float(raw)
    except (TypeError, ValueError):
        return {'min_rate': None, 'max_rate': None}
    if rate <= 0:
        return {'min_rate': None, 'max_rate': None}
    return {'min_rate': rate, 'max_rate': rate}


def _metal_band_values(base_min: float, base_max: float, *, deviation_fraction: float) -> dict[str, float]:
    return {
        'base_min': base_min,
        'base_max': base_max,
        'final_min': base_min * (1.0 - deviation_fraction),
        'final_max': base_max * (1.0 + deviation_fraction),
    }


@lru_cache(maxsize=1)
def product_rule_book_specs() -> dict[str, dict[str, float | None]]:
    """Normalized product name → configured min/max rates (null when unset)."""
    cfg = load_metal_rate_rule_book_config()
    specs: dict[str, dict[str, float | None]] = {}
    for product in METAL_RATE_RULE_BOOK_PRODUCTS:
        norm = normalize_strict_text(product)
        if not norm:
            continue
        raw = cfg.get(product, cfg.get(norm))
        specs[norm] = _parse_metal_rate_entry(raw)
    return specs


@lru_cache(maxsize=1)
def metal_final_bands_by_product() -> dict[str, dict[str, float]]:
    """Normalized product → bands after -15% on min and +15% on max."""
    fraction = metal_deviation_fraction()
    bands: dict[str, dict[str, float]] = {}
    for norm, spec in product_rule_book_specs().items():
        base_min = spec.get('min_rate')
        base_max = spec.get('max_rate')
        if base_min is None or base_max is None:
            continue
        bands[norm] = _metal_band_values(base_min, base_max, deviation_fraction=fraction)
    return bands


def clear_metal_rate_caches() -> None:
    load_metal_rate_rule_book_config.cache_clear()
    product_rule_book_specs.cache_clear()
    product_rule_book_rates.cache_clear()
    metal_final_bands_by_product.cache_clear()
    metal_deviation_fraction.cache_clear()
    load_diamond_rate_rule_book.cache_clear()
    load_diamond_hardcoded_rates.cache_clear()
    diamond_editable_product_keys.cache_clear()
    diamond_rule_book_entries.cache_clear()
    diamond_final_bands_by_product.cache_clear()
    load_uom_rules_config.cache_clear()
    grams_product_norms.cache_clear()


@lru_cache(maxsize=1)
def metal_deviation_fraction() -> float:
    pct = float(load_metal_rate_rule_book_config().get('allowed_variation_percent', 30))
    return pct / 100.0


@lru_cache(maxsize=1)
def product_rule_book_rates() -> dict[str, float | None]:
    """Midpoint of configured min/max — for backwards-compatible callers."""
    rates: dict[str, float | None] = {}
    for norm, spec in product_rule_book_specs().items():
        base_min = spec.get('min_rate')
        base_max = spec.get('max_rate')
        if base_min is None or base_max is None:
            rates[norm] = None
        else:
            rates[norm] = (base_min + base_max) / 2.0
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

from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import metal_deviation_fraction, rate_validation_families
from app.sales_engine.parsers.metal_rate import metal_rate_applies_expr
from app.sales_engine.parsers.product_category import extracted_slab_price_expr

_METAL_RATE_SOURCE = 'rule_book_product'
_GEM_RATE_SOURCE = 'product_slab'


def enrich_metal_rate_columns(
    *,
    uploaded_unit_rate_col: str = '__uploaded_unit_rate',
) -> list[pl.Expr]:
    fraction = metal_deviation_fraction()
    standard = pl.col('__metal_rule_book_rate')
    applies = pl.col('__metal_rate_applies').fill_null(False)
    uploaded = pl.col(uploaded_unit_rate_col)
    min_rate = standard * (1.0 - fraction)
    max_rate = standard * (1.0 + fraction)
    metal_ready = (
        applies
        & standard.is_not_null()
        & uploaded.is_not_null()
        & (uploaded > 0)
    )
    metal_below = metal_ready & (uploaded < min_rate)
    metal_above = metal_ready & (uploaded > max_rate)
    metal_valid = metal_ready & ~metal_below & ~metal_above
    metal_invalid = metal_below | metal_above
    metal_unit_missing = pl.col('__metal_rate_applies').fill_null(False) & (
        uploaded.is_null() | (uploaded <= 0)
    )
    metal_result = (
        pl.when(~applies | standard.is_null())
        .then(pl.lit('NOT_APPLICABLE'))
        .when(uploaded.is_null() | (uploaded <= 0))
        .then(pl.lit('UNIT_RATE_INVALID'))
        .when(metal_valid)
        .then(pl.lit('PASS'))
        .when(metal_invalid)
        .then(pl.lit('FAIL'))
        .otherwise(pl.lit('SKIPPED'))
    )
    return [
        metal_invalid.alias('__metal_rate_invalid_raw'),
        metal_below.alias('__metal_rate_below_min'),
        metal_above.alias('__metal_rate_above_max'),
        metal_unit_missing.alias('__metal_unit_rate_missing'),
        min_rate.alias('__metal_min_allowed_rate'),
        max_rate.alias('__metal_max_allowed_rate'),
        metal_result.alias('__metal_rate_validation_result'),
    ]


def combine_rate_validation_columns(
    *,
    uploaded_unit_rate_col: str = '__uploaded_unit_rate',
    product_col: str = '__product_norm',
    family_col: str = '__slab_family',
) -> list[pl.Expr]:
    """Merge gemstone slab rates and gold/silver market rates into export columns."""
    gem_slab = pl.col('__gem_extracted_master_price')
    gem_invalid = pl.col('__gem_rate_invalid_raw').fill_null(False)
    gem_min = pl.col('__gem_min_allowed_rate')
    gem_max = pl.col('__gem_max_allowed_rate')
    gem_source = pl.col('__gem_rate_validation_source')

    metal_applies = pl.col('__metal_rate_applies').fill_null(False)
    metal_standard = pl.col('__metal_rule_book_rate')
    metal_invalid = pl.col('__metal_rate_invalid_raw').fill_null(False)
    metal_min = pl.col('__metal_min_allowed_rate')
    metal_max = pl.col('__metal_max_allowed_rate')

    rate_families = pl.col(family_col).is_in(list(rate_validation_families()))
    gem_rate_active = rate_families & gem_slab.is_not_null()

    combined_standard = (
        pl.when(metal_applies)
        .then(metal_standard)
        .when(gem_rate_active)
        .then(gem_slab)
        .otherwise(None)
    )
    combined_min = pl.when(metal_applies).then(metal_min).when(gem_rate_active).then(gem_min).otherwise(None)
    combined_max = pl.when(metal_applies).then(metal_max).when(gem_rate_active).then(gem_max).otherwise(None)
    gem_below = pl.col('__gem_rate_below_min').fill_null(False)
    gem_above = pl.col('__gem_rate_above_max').fill_null(False)
    gem_unit_missing = pl.col('__gem_unit_rate_missing').fill_null(False)
    combined_below = metal_invalid & pl.col('__metal_rate_below_min').fill_null(False) | gem_below
    combined_above = pl.col('__metal_rate_above_max').fill_null(False) | gem_above
    combined_unit_missing = pl.col('__metal_unit_rate_missing').fill_null(False) | gem_unit_missing
    combined_invalid = gem_invalid | metal_invalid | combined_unit_missing.fill_null(False)
    combined_source = (
        pl.when(metal_applies)
        .then(pl.lit(_METAL_RATE_SOURCE))
        .when(gem_rate_active)
        .then(pl.lit(_GEM_RATE_SOURCE))
        .otherwise(gem_source)
    )
    uploaded = pl.col(uploaded_unit_rate_col)
    combined_valid = combined_invalid.fill_null(False).not_() & uploaded.is_not_null() & (uploaded > 0)

    validation_status = (
        pl.when(~pl.col('__mapping_valid').fill_null(False))
        .then(pl.lit('MAPPING_PENDING'))
        .when(combined_invalid)
        .then(pl.lit('INVALID'))
        .when(metal_applies | gem_rate_active)
        .then(pl.lit('VALID'))
        .otherwise(pl.lit('NOT_APPLICABLE'))
    )

    return [
        combined_standard.alias('__extracted_master_price'),
        combined_min.alias('__min_allowed_rate'),
        combined_max.alias('__max_allowed_rate'),
        combined_invalid.alias('__rate_invalid_raw'),
        combined_below.alias('__rate_below_min'),
        combined_above.alias('__rate_above_max'),
        combined_unit_missing.alias('__rate_unit_missing'),
        combined_valid.alias('__rate_valid'),
        combined_source.alias('__rate_validation_source'),
        validation_status.alias('__validation_status'),
        metal_standard.alias('__current_market_rate'),
    ]



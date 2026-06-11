from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import deviation_fraction, rate_validation_families
from app.sales_engine.parsers.product_category import extracted_slab_price_expr

_RATE_VALIDATION_SOURCE = 'product_slab'


def enrich_rate_columns(
    *,
    uploaded_unit_rate_col: str = '__uploaded_unit_rate',
    product_col: str = '__product_norm',
    family_col: str = '__slab_family',
) -> list[pl.Expr]:
    fraction = deviation_fraction()
    slab = extracted_slab_price_expr(product_col=product_col, family_col=family_col)
    rate_families = pl.col(family_col).is_in(list(rate_validation_families()))
    min_rate = slab * (1.0 - fraction)
    max_rate = slab * (1.0 + fraction)
    uploaded = pl.col(uploaded_unit_rate_col)
    rate_ready = (
        rate_families
        & slab.is_not_null()
        & uploaded.is_not_null()
        & (uploaded > 0)
    )
    rate_below = rate_ready & (uploaded < min_rate)
    rate_above = rate_ready & (uploaded > max_rate)
    rate_valid = rate_ready & ~rate_below & ~rate_above
    invalid_rate = rate_below | rate_above
    gem_unit_missing = rate_families & slab.is_not_null() & (uploaded.is_null() | (uploaded <= 0))
    rate_result = (
        pl.when(~rate_families)
        .then(pl.lit('NOT_APPLICABLE'))
        .when(pl.col('__gem_slab_shape') & slab.is_null())
        .then(pl.lit('PRICE_PARSE_FAILED'))
        .when(uploaded.is_null() | (uploaded <= 0))
        .then(pl.lit('UNIT_RATE_INVALID'))
        .when(rate_valid)
        .then(pl.lit('PASS'))
        .when(invalid_rate)
        .then(pl.lit('FAIL'))
        .otherwise(pl.lit('SKIPPED'))
    )
    return [
        slab.alias('__gem_extracted_master_price'),
        min_rate.alias('__gem_min_allowed_rate'),
        max_rate.alias('__gem_max_allowed_rate'),
        pl.when(rate_ready)
        .then(pl.lit(_RATE_VALIDATION_SOURCE))
        .otherwise(pl.lit('skipped'))
        .alias('__gem_rate_validation_source'),
        rate_valid.alias('__gem_rate_valid'),
        invalid_rate.alias('__gem_rate_invalid_raw'),
        rate_below.alias('__gem_rate_below_min'),
        rate_above.alias('__gem_rate_above_max'),
        gem_unit_missing.alias('__gem_unit_rate_missing'),
        rate_result.alias('__gem_rate_validation_result'),
    ]

from __future__ import annotations

import polars as pl

_DIAMOND_RATE_SOURCE = 'diamond_rule_book'


def enrich_diamond_rate_columns(
    *,
    uploaded_unit_rate_col: str = '__uploaded_unit_rate',
) -> list[pl.Expr]:
    """Validate invoice unit rate against hard-coded diamond bands (+25%, then +/-30%)."""
    applies = pl.col('__diamond_rate_applies').fill_null(False)
    uploaded = pl.col(uploaded_unit_rate_col)
    min_rate = pl.col('__diamond_min_allowed_rate')
    max_rate = pl.col('__diamond_max_allowed_rate')
    ready = (
        applies
        & min_rate.is_not_null()
        & max_rate.is_not_null()
        & uploaded.is_not_null()
        & (uploaded > 0)
    )
    below = ready & (uploaded < min_rate)
    above = ready & (uploaded > max_rate)
    valid = ready & ~below & ~above
    invalid = below | above
    unit_missing = applies & (uploaded.is_null() | (uploaded <= 0))
    result = (
        pl.when(~applies)
        .then(pl.lit('NOT_APPLICABLE'))
        .when(uploaded.is_null() | (uploaded <= 0))
        .then(pl.lit('UNIT_RATE_INVALID'))
        .when(valid)
        .then(pl.lit('PASS'))
        .when(invalid)
        .then(pl.lit('FAIL'))
        .otherwise(pl.lit('SKIPPED'))
    )
    return [
        invalid.alias('__diamond_rate_invalid_raw'),
        below.alias('__diamond_rate_below_min'),
        above.alias('__diamond_rate_above_max'),
        unit_missing.alias('__diamond_unit_rate_missing'),
        result.alias('__diamond_rate_validation_result'),
        pl.when(applies)
        .then(pl.lit(_DIAMOND_RATE_SOURCE))
        .otherwise(pl.lit(None))
        .alias('__diamond_rate_validation_source'),
    ]

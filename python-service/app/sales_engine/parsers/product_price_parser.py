from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import price_patterns, rate_validation_families


def extracted_master_price_expr(
    *,
    product_col: str = '__product_norm',
    family_col: str = '__product_family',
) -> pl.Expr:
    """Extract slab price only when product_family has a configured price pattern."""
    col = pl.col(product_col)
    family = pl.col(family_col)
    extracted: pl.Expr | None = None
    for fam in rate_validation_families():
        pattern = price_patterns().get(fam)
        if not pattern:
            continue
        piece = (
            pl.when(family == fam)
            .then(col.str.extract(pattern, 1).cast(pl.Float64, strict=False))
            .otherwise(None)
        )
        extracted = piece if extracted is None else pl.coalesce(extracted, piece)
    alias = '__extracted_master_price'
    if extracted is None:
        return pl.lit(None).cast(pl.Float64).alias(alias)
    return extracted.alias(alias)

from __future__ import annotations

import polars as pl

from app.engines.sales_engine.config.loader import diamond_final_bands_by_product, diamond_rule_book_entries


def diamond_rate_expected_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when product is listed in the diamond rule book (including placeholders)."""
    product = pl.col(product_col)
    match = pl.lit(False)
    for norm_product in diamond_rule_book_entries():
        match = match | (product == norm_product)
    return match.alias('__diamond_rate_expected')


def diamond_rate_applies_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when rule-book SKU has configured bands (not a placeholder)."""
    product = pl.col(product_col)
    match = pl.lit(False)
    for norm_product in diamond_final_bands_by_product():
        match = match | (product == norm_product)
    return match.alias('__diamond_rate_applies')


def diamond_band_column_exprs(product_col: str = '__product_norm') -> list[pl.Expr]:
    """Lookup final min/max bands per rule-book SKU."""
    product = pl.col(product_col)
    min_expr = pl.lit(None).cast(pl.Float64)
    max_expr = pl.lit(None).cast(pl.Float64)
    base_min_expr = pl.lit(None).cast(pl.Float64)
    base_max_expr = pl.lit(None).cast(pl.Float64)
    min_only_expr = pl.lit(False)
    for norm_product, band in diamond_final_bands_by_product().items():
        min_only = bool(band.get('min_only', False))
        min_expr = (
            pl.when(product == norm_product)
            .then(pl.lit(band['final_min']))
            .otherwise(min_expr)
        )
        if band.get('final_max') is not None:
            max_expr = (
                pl.when(product == norm_product)
                .then(pl.lit(band['final_max']))
                .otherwise(max_expr)
            )
        base_min_expr = (
            pl.when(product == norm_product)
            .then(pl.lit(band['base_min']))
            .otherwise(base_min_expr)
        )
        if band.get('base_max') is not None:
            base_max_expr = (
                pl.when(product == norm_product)
                .then(pl.lit(band['base_max']))
                .otherwise(base_max_expr)
            )
        if min_only:
            min_only_expr = pl.when(product == norm_product).then(pl.lit(True)).otherwise(min_only_expr)
    return [
        min_expr.alias('__diamond_min_allowed_rate'),
        max_expr.alias('__diamond_max_allowed_rate'),
        base_min_expr.alias('__diamond_base_min_rate'),
        base_max_expr.alias('__diamond_base_max_rate'),
        min_only_expr.alias('__diamond_min_only'),
    ]

from __future__ import annotations

import polars as pl

from app.engines.sales_engine.config.loader import METAL_RATE_RULE_BOOK_PRODUCTS, metal_final_bands_by_product
from app.utils.normalization_engine import normalize_strict_text


def metal_band_column_exprs(product_col: str = '__product_norm') -> list[pl.Expr]:
    """Lookup final min/max bands per gold/silver rule-book SKU."""
    product = pl.col(product_col)
    min_expr = pl.lit(None).cast(pl.Float64)
    max_expr = pl.lit(None).cast(pl.Float64)
    base_min_expr = pl.lit(None).cast(pl.Float64)
    base_max_expr = pl.lit(None).cast(pl.Float64)
    ref_expr = pl.lit(None).cast(pl.Float64)
    for norm_product, band in metal_final_bands_by_product().items():
        min_expr = (
            pl.when(product == norm_product)
            .then(pl.lit(band['final_min']))
            .otherwise(min_expr)
        )
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
        base_max_expr = (
            pl.when(product == norm_product)
            .then(pl.lit(band['base_max']))
            .otherwise(base_max_expr)
        )
        ref_expr = (
            pl.when(product == norm_product)
            .then(pl.lit((band['base_min'] + band['base_max']) / 2.0))
            .otherwise(ref_expr)
        )
    return [
        min_expr.alias('__metal_min_allowed_rate'),
        max_expr.alias('__metal_max_allowed_rate'),
        base_min_expr.alias('__metal_base_min_rate'),
        base_max_expr.alias('__metal_base_max_rate'),
        ref_expr.alias('__metal_rule_book_rate'),
    ]


def product_in_rule_book_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when normalized product is one of the rule-book SKUs."""
    product = pl.col(product_col)
    match = pl.lit(False)
    for name in METAL_RATE_RULE_BOOK_PRODUCTS:
        norm = normalize_strict_text(name)
        if norm:
            match = match | (product == norm)
    return match


def metal_rate_applies_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when product has configured min/max bands in the rule book."""
    product = pl.col(product_col)
    match = pl.lit(False)
    for norm_product in metal_final_bands_by_product():
        match = match | (product == norm_product)
    return match.alias('__metal_rate_applies')


def metal_rate_expected_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when product is a rule-book SKU (rates may still be unset)."""
    return product_in_rule_book_expr(product_col).alias('__metal_rate_expected')

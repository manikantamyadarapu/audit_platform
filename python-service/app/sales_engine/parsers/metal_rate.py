from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import METAL_RATE_RULE_BOOK_PRODUCTS, product_rule_book_rates
from app.utils.normalization_engine import normalize_strict_text


def product_rule_book_rate_expr(product_col: str = '__product_norm') -> pl.Expr:
    """Entered rate from the metal rate rule book for this product (null if not configured)."""
    product = pl.col(product_col)
    expr = pl.lit(None).cast(pl.Float64)
    for norm_product, rate in product_rule_book_rates().items():
        if rate is not None:
            expr = pl.when(product == norm_product).then(pl.lit(rate)).otherwise(expr)
    return expr.alias('__metal_rule_book_rate')


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
    """True when product is in the rule book and has a configured entered rate."""
    return pl.col('__metal_rule_book_rate').is_not_null().alias('__metal_rate_applies')


def metal_rate_expected_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when product is a rule-book SKU (rate may still be unset)."""
    return product_in_rule_book_expr(product_col).alias('__metal_rate_expected')

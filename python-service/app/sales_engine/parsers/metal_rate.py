from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import product_rule_book_rates


def product_rule_book_rate_expr(product_col: str = '__product_norm') -> pl.Expr:
    """Entered rate from the metal rate rule book for this product (null if not configured)."""
    product = pl.col(product_col)
    expr = pl.lit(None).cast(pl.Float64)
    for norm_product, rate in product_rule_book_rates().items():
        if rate is not None:
            expr = pl.when(product == norm_product).then(pl.lit(rate)).otherwise(expr)
    return expr.alias('__metal_rule_book_rate')


def metal_rate_applies_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when product is in the rule book and has a configured entered rate."""
    return pl.col('__metal_rule_book_rate').is_not_null().alias('__metal_rate_applies')

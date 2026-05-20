from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import (
    gold_account_standard_rates,
    metal_rate_product_patterns,
    metal_rate_skip_product_patterns,
    silver_account_standard_rate,
)

_SILVER_ACCOUNT = 'SILVER SALES ACCOUNT'


def account_standard_rate_expr(sales_account_col: str = '__sales_account_norm') -> pl.Expr:
    """Configured standard rate for gold/silver sales accounts (null when not configured)."""
    account = pl.col(sales_account_col)
    expr = pl.lit(None).cast(pl.Float64)
    for acc, rate in gold_account_standard_rates().items():
        if rate is not None:
            expr = pl.when(account == acc).then(pl.lit(rate)).otherwise(expr)
    silver_rate = silver_account_standard_rate()
    if silver_rate is not None:
        expr = pl.when(account == _SILVER_ACCOUNT).then(pl.lit(silver_rate)).otherwise(expr)
    return expr.alias('__metal_account_standard_rate')


def _metal_rate_product_match_expr(product_col: str = '__product_norm') -> pl.Expr:
    product = pl.col(product_col)
    match = pl.lit(False)
    for metal, patterns in metal_rate_product_patterns():
        for pattern in patterns:
            match = match | product.str.contains(pattern)
    return match


def _metal_rate_skip_product_expr(product_col: str = '__product_norm') -> pl.Expr:
    product = pl.col(product_col)
    skip = pl.lit(False)
    for pattern in metal_rate_skip_product_patterns():
        skip = skip | product.str.contains(f'(?i){pattern}')
    return skip


def metal_rate_applies_expr(
    *,
    sales_account_col: str = '__sales_account_norm',
    product_col: str = '__product_norm',
) -> pl.Expr:
    """
    True when this row should use account-level gold/silver rate validation
    (configured standard rate + qualifying product + not a skip SKU).
    """
    standard = pl.col('__metal_account_standard_rate')
    return (
        standard.is_not_null()
        & _metal_rate_product_match_expr(product_col)
        & ~_metal_rate_skip_product_expr(product_col)
    ).alias('__metal_rate_applies')

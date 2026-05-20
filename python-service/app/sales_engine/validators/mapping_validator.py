from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import account_product_prefixes, known_sales_accounts, sales_account_aliases


def _prefix_match_expr(product_col: str, prefix: str) -> pl.Expr:
    prefix_lit = pl.lit(prefix)
    return (pl.col(product_col) == prefix_lit) | pl.col(product_col).str.starts_with(prefix_lit + pl.lit(' '))


def sales_account_canonical_expr(column: str = '__sales_account_norm') -> pl.Expr:
    """Map upload spellings to canonical account keys."""
    canonical = pl.col(column)
    for alias, target in sales_account_aliases().items():
        canonical = pl.when(canonical == alias).then(pl.lit(target)).otherwise(canonical)
    return canonical.alias(column)


def mapping_valid_expr(
    *,
    sales_account_col: str = '__sales_account_norm',
    product_col: str = '__product_norm',
) -> pl.Expr:
    """Strict prefix-based account ↔ product validation (deterministic, no fuzzy matching)."""
    per_account: list[pl.Expr] = []
    for account, prefixes in account_product_prefixes().items():
        prefix_match = pl.lit(False)
        for prefix in prefixes:
            prefix_match = prefix_match | _prefix_match_expr(product_col, prefix)
        per_account.append((pl.col(sales_account_col) == account) & prefix_match)
    if not per_account:
        return pl.lit(False).alias('__mapping_valid')
    return (
        pl.col(sales_account_col).is_in(list(known_sales_accounts()))
        & pl.any_horizontal(per_account)
    ).alias('__mapping_valid')

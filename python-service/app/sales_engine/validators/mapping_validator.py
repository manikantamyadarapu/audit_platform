from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import (
    catalog_accounts_and_patterns,
    known_sales_accounts,
    purchase_to_sales_account_aliases,
    sales_account_aliases,
)

_ACCOUNT_ALLOWED_SLAB: dict[str, frozenset[str]] = {
    'JEWELS SALES ACCOUNT - RUBIES': frozenset({'RUBIES'}),
    'JEWELS SALES ACCOUNT - EMERALDS': frozenset({'EMERALDS'}),
    'JEWELS SALES ACCOUNT - PEARLS': frozenset({'PEARLS'}),
    'JEWELS SALES ACCOUNT - COLOR STONES': frozenset({'COLOR_STONES', 'SEMI_PRECIOUS', 'SYNTHETIC'}),
    'JEWEL SALES ACCOUNT - DIAMONDS': frozenset({'DIAMONDS'}),
}


def _alias_replace_expr(column: str, aliases: dict[str, str]) -> pl.Expr:
    """Fast dict-based alias remap (avoids deep nested when/then trees)."""
    if not aliases:
        return pl.col(column).alias(column)
    return pl.col(column).replace(aliases).alias(column)


def purchase_to_sales_account_expr(column: str = '__sales_account_norm') -> pl.Expr:
    """Map purchase ledger account labels to sales canonical accounts for validation."""
    return _alias_replace_expr(column, purchase_to_sales_account_aliases())


def sales_account_canonical_expr(column: str = '__sales_account_norm') -> pl.Expr:
    """Map upload spellings to canonical sales ledger account keys."""
    return _alias_replace_expr(column, sales_account_aliases())


def _account_catalog_match_expr(
    *,
    sales_account_col: str = '__sales_account_norm',
    product_col: str = '__product_norm',
) -> pl.Expr:
    """True when product matches the catalog rules for the row's sales account."""
    per_account: list[pl.Expr] = []
    product = pl.col(product_col)
    for account, patterns in catalog_accounts_and_patterns():
        match = pl.lit(False)
        for pattern in patterns:
            match = match | product.str.contains(pattern)
        per_account.append((pl.col(sales_account_col) == account) & match)
    if not per_account:
        return pl.lit(False)
    return pl.any_horizontal(per_account)


def _any_catalog_product_match_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when product matches any account's catalog (used for cross-account detection)."""
    product = pl.col(product_col)
    matches: list[pl.Expr] = []
    for _account, patterns in catalog_accounts_and_patterns():
        match = pl.lit(False)
        for pattern in patterns:
            match = match | product.str.contains(pattern)
        matches.append(match)
    if not matches:
        return pl.lit(False)
    return pl.any_horizontal(matches)


def _slab_family_conflict_expr(
    *,
    sales_account_col: str = '__sales_account_norm',
    family_col: str = '__slab_family',
) -> pl.Expr:
    conflict = pl.lit(False)
    family = pl.col(family_col)
    for account, allowed in _ACCOUNT_ALLOWED_SLAB.items():
        wrong_on_account = (
            (pl.col(sales_account_col) == account)
            & family.is_not_null()
            & ~family.is_in(list(allowed))
        )
        conflict = conflict | wrong_on_account
    return conflict


def mapping_valid_expr(
    *,
    sales_account_col: str = '__sales_account_norm',
    product_col: str = '__product_norm',
    family_col: str = '__slab_family',
) -> pl.Expr:
    """
    Valid when sales account is known and product matches the official sales ledger catalog
    for that account (deterministic regex rules from sales_ledger_catalog.json).
    """
    account = pl.col(sales_account_col)
    is_known = account.is_in(list(known_sales_accounts()))
    catalog_ok = _account_catalog_match_expr(
        sales_account_col=sales_account_col, product_col=product_col
    )
    on_any_catalog = _any_catalog_product_match_expr(product_col=product_col)
    cross_account = is_known & on_any_catalog & ~catalog_ok
    no_slab_conflict = ~_slab_family_conflict_expr(
        sales_account_col=sales_account_col, family_col=family_col
    )
    # Unrecognized SKUs (no catalog hit) defer to UNKNOWN / rate logic, not mapping.
    return (is_known & ~cross_account & no_slab_conflict).alias('__mapping_valid')

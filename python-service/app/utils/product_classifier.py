"""Compatibility wrappers around the CSV-backed master sales rule engine."""

from __future__ import annotations

from functools import lru_cache

from app.utils.master_sales_rule_engine import (
    FUZZY_PARTIAL_THRESHOLD,
    lookup_product_rule,
    lookup_sales_account_rule,
    normalize_product_name,
)


def direct_category_from_product_normalized(prod_norm: str) -> str | None:
    """Keyword-style category detection on already-normalized product text."""
    match = lookup_product_rule(prod_norm, allow_fuzzy=False)
    return match.category


def classify_product_direct(product: str) -> str | None:
    """Direct rule lookup only (no fuzzy fallback)."""
    match = lookup_product_rule(product, allow_fuzzy=False)
    return match.category


def classify_product_with_detail(product: str) -> tuple[str | None, bool]:
    """Return (category, used_fuzzy) using the master sales rules."""
    match = lookup_product_rule(product, allow_fuzzy=True)
    return match.category, match.used_fuzzy


def classify_product(product: str) -> str | None:
    """Public API: predicted category from product text, or None."""
    category, _ = classify_product_with_detail(product)
    return category


@lru_cache(maxsize=50_000)
def classify_product_cached(product: str) -> tuple[str | None, bool]:
    """Cached classification for repeated product strings in large ledgers."""
    return classify_product_with_detail(product)


@lru_cache(maxsize=8192)
def expected_category_from_sales_account(sales_account: str) -> str | None:
    """Return the category implied by a sales account label."""
    match = lookup_sales_account_rule(sales_account, allow_fuzzy=False)
    return match.category

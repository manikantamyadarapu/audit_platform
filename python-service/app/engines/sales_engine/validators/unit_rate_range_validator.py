"""Unit rate range validator for specific products requiring 0-1 range."""
from __future__ import annotations

import polars as pl

# Products that require unit rate between 0 and 1 (inclusive)
ZERO_TO_ONE_PRODUCTS: frozenset[str] = frozenset({
    'LAC',
    'NAIL',
    'KUNDAN',
    'DORI',
    'BLACK BEADS',
    'WAX',
    'WAX, DORI ETC',
    'WAX DORI ETC',
})


def zero_to_one_product_validator(
    uploaded_unit_rate_col: str = '__uploaded_unit_rate',
    product_col: str = '__product_norm',
) -> list[pl.Expr]:
    """
    Returns Polars expressions to validate unit rate range (0-1) for specific products.

    - Products: Lac, Nail, Dori, Black beads, Wax, Wax Dori Etc
    - Valid range: 0 <= unit_rate <= 1 (inclusive)
    - NULL unit_rate is not flagged (handled by missing rate validation)

    Returns columns:
    - __zero_to_one_product: bool - True if product is in the zero-to-one list
    - __invalid_unit_rate_range: bool - True if unit rate is outside 0-1 range
    """
    uploaded = pl.col(uploaded_unit_rate_col)
    product = pl.col(product_col)

    # Check if product is in the zero-to-one list
    is_zero_to_one_product = product.is_in(list(ZERO_TO_ONE_PRODUCTS))

    # Check if unit rate is valid (between 0 and 1, inclusive)
    unit_rate_valid = uploaded.is_not_null() & (uploaded >= 0) & (uploaded <= 1)
    unit_rate_invalid = is_zero_to_one_product & uploaded.is_not_null() & ~unit_rate_valid

    return [
        is_zero_to_one_product.alias('__zero_to_one_product'),
        unit_rate_invalid.alias('__invalid_unit_rate_range'),
    ]

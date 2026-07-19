from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import misc_product_patterns, slab_route_order, slab_route_patterns

_COLOR_STONE_COMBINED = (
    r'^(PRECIOUS\s+STONES|SEMI\s+PRECIOUS)(?:\s+LOOSE)?\s+(JOS|JSP)\s+(\d+)$'
)

_ACCOUNT_CATEGORY: dict[str, str] = {
    'JEWELS SALES ACCOUNT - RUBIES': 'RUBIES',
    'JEWELS SALES ACCOUNT - EMERALDS': 'EMERALDS',
    'JEWELS SALES ACCOUNT - PEARLS': 'PEARLS',
    'JEWELS SALES ACCOUNT - COLOR STONES': 'COLOR_STONES',
    'JEWEL SALES ACCOUNT - DIAMONDS': 'DIAMONDS',
    'GOLD SALES ACCOUNT - 14K': 'GOLD',
    'GOLD SALES ACCOUNT - 18K': 'GOLD',
    'GOLD SALES ACCOUNT - 22K': 'GOLD',
    'GOLD SALES ACCOUNT - JADAU': 'GOLD',
    'GOLD SALES ACCOUNT - 24K': 'GOLD',
    'SILVER SALES ACCOUNT': 'SILVER',
    # Purchase Account masters derived from Sales (SALES ACCOUNT → PURCHASES ACCOUNT)
    'JEWELS PURCHASES ACCOUNT - RUBIES': 'RUBIES',
    'JEWELS PURCHASES ACCOUNT - EMERALDS': 'EMERALDS',
    'JEWELS PURCHASES ACCOUNT - PEARLS': 'PEARLS',
    'JEWELS PURCHASES ACCOUNT - COLOR STONES': 'COLOR_STONES',
    'JEWEL PURCHASES ACCOUNT - DIAMONDS': 'DIAMONDS',
    'GOLD PURCHASES ACCOUNT - 14K': 'GOLD',
    'GOLD PURCHASES ACCOUNT - 18K': 'GOLD',
    'GOLD PURCHASES ACCOUNT - 22K': 'GOLD',
    'GOLD PURCHASES ACCOUNT - JADAU': 'GOLD',
    'GOLD PURCHASES ACCOUNT - 24K': 'GOLD',
    'SILVER PURCHASES ACCOUNT': 'SILVER',
}


def account_category_expr(sales_account_col: str = '__sales_account_norm') -> pl.Expr:
    pieces: list[pl.Expr] = []
    for account, category in _ACCOUNT_CATEGORY.items():
        pieces.append(pl.when(pl.col(sales_account_col) == account).then(pl.lit(category)))
    return pl.coalesce(pieces).alias('__account_category')


def detected_category_expr(product_col: str = '__product_norm') -> pl.Expr:
    """Strict full-string category from product name (deterministic regex)."""
    product = pl.col(product_col)
    pieces: list[pl.Expr] = [
        pl.when(product.str.contains(f'(?i)^{_COLOR_STONE_COMBINED}$'))
        .then(
            pl.when(product.str.contains(r'(?i)^SEMI\s+PRECIOUS'))
            .then(pl.lit('SEMI_PRECIOUS'))
            .otherwise(pl.lit('COLOR_STONES'))
        ),
    ]
    for family in slab_route_order():
        pattern = slab_route_patterns().get(family)
        if not pattern or family in {'COLOR_STONES', 'SEMI_PRECIOUS'}:
            continue
        pieces.append(pl.when(product.str.contains(f'(?i){pattern}')).then(pl.lit(family)))
    misc = pl.lit(False)
    for pattern in misc_product_patterns():
        misc = misc | product.str.contains(f'(?i){pattern}')
    pieces.extend(
        [
            pl.when(product.str.contains(r'(?i)^SILVER')).then(pl.lit('SILVER')),
            pl.when(
                product.str.contains(r'(?i)^(GOLD|BLACK BEADS|DORI|LAC|WAX|STANDARD GOLD|CUSTOMER GOLD)')
            ).then(pl.lit('GOLD')),
            pl.when(misc).then(pl.lit('GOLD_MISC')),
        ]
    )
    return pl.coalesce(pieces).alias('__detected_category')


def slab_family_expr(product_col: str = '__product_norm') -> pl.Expr:
    """Slab family code used for rate validation routing."""
    product = pl.col(product_col)
    pieces: list[pl.Expr] = []
    for family in slab_route_order():
        pattern = slab_route_patterns().get(family)
        if not pattern:
            continue
        pieces.append(pl.when(product.str.contains(f'(?i){pattern}')).then(pl.lit(family)))
    if not pieces:
        return pl.lit(None).cast(pl.Utf8).alias('__slab_family')
    return pl.coalesce(pieces).alias('__slab_family')


def extracted_slab_price_expr(
    *,
    product_col: str = '__product_norm',
    family_col: str = '__slab_family',
) -> pl.Expr:
    product = pl.col(product_col)
    family = pl.col(family_col)
    from_combined = (
        pl.when(family.is_in(['COLOR_STONES', 'SEMI_PRECIOUS']))
        .then(product.str.extract(_COLOR_STONE_COMBINED, 3).cast(pl.Float64, strict=False))
        .otherwise(None)
    )
    extracted: pl.Expr | None = from_combined
    for fam, pattern in slab_route_patterns().items():
        if fam in {'COLOR_STONES', 'SEMI_PRECIOUS'}:
            continue
        piece = (
            pl.when(family == fam)
            .then(product.str.extract(pattern, 1).cast(pl.Float64, strict=False))
            .otherwise(None)
        )
        extracted = piece if extracted is None else pl.coalesce(extracted, piece)
    if extracted is None:
        return pl.lit(None).cast(pl.Float64).alias('__extracted_master_price')
    return extracted.alias('__extracted_master_price')


def gem_slab_shape_expr(product_col: str = '__product_norm') -> pl.Expr:
    """True when product name matches any numbered gemstone slab pattern."""
    product = pl.col(product_col)
    match = product.str.contains(f'(?i){_COLOR_STONE_COMBINED}')
    for pattern in slab_route_patterns().values():
        match = match | product.str.contains(f'(?i){pattern}')
    return match.alias('__gem_slab_shape')

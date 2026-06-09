from __future__ import annotations

import polars as pl

from app.sales_engine.config.loader import grams_product_norms

UOM_GRAMS = 'GRAMS'
UOM_CARATS = 'CARATS'
PEARLS_JPS_PATTERN = r'^PEARLS\s+JPS\s+\d+$'


def normalize_uom_value(value: object) -> str | None:
    """Map raw UOM text to GRAMS or CARATS."""
    if value is None:
        return None
    text = str(value).strip().upper()
    if not text:
        return None
    compact = ''.join(ch for ch in text if ch.isalnum())
    if compact in {'GRAMS', 'GRAM', 'GMS', 'GM', 'G'} or 'GRAM' in compact:
        return UOM_GRAMS
    if compact in {'CARATS', 'CARAT', 'CTS', 'CRT', 'CT'} or 'CARAT' in compact or compact == 'CTS':
        return UOM_CARATS
    return None


def invoice_uom_expr(uom_col: str = 'uom') -> pl.Expr:
    raw = pl.col(uom_col).cast(pl.Utf8, strict=False).fill_null('').str.strip_chars().str.to_uppercase()
    compact = raw.str.replace_all(r'[^A-Z0-9]', '')
    return (
        pl.when(compact.is_in(['GRAMS', 'GRAM', 'GMS', 'GM', 'G']))
        .then(pl.lit(UOM_GRAMS))
        .when(compact.str.contains('GRAM'))
        .then(pl.lit(UOM_GRAMS))
        .when(compact.is_in(['CARATS', 'CARAT', 'CTS', 'CRT', 'CT']))
        .then(pl.lit(UOM_CARATS))
        .when(compact.str.contains('CARAT'))
        .then(pl.lit(UOM_CARATS))
        .when(compact == 'CTS')
        .then(pl.lit(UOM_CARATS))
        .otherwise(None)
        .alias('__invoice_uom')
    )


def expected_uom_expr(product_col: str = '__product_norm') -> pl.Expr:
    product = pl.col(product_col)
    expected = pl.lit(UOM_CARATS)
    for norm_product in grams_product_norms():
        expected = pl.when(product == norm_product).then(pl.lit(UOM_GRAMS)).otherwise(expected)
    expected = pl.when(product.str.contains(PEARLS_JPS_PATTERN)).then(pl.lit(UOM_GRAMS)).otherwise(expected)
    return expected.alias('__expected_uom')


def enrich_uom_validation_columns() -> list[pl.Expr]:
    is_txn = (
        pl.col('__is_transaction_row').fill_null(False)
        & ~pl.col('__is_blank_row').fill_null(False)
        & ~pl.col('__is_repeated_header').fill_null(False)
    )
    mismatch = (
        pl.col('__invoice_uom').is_null()
        | (pl.col('__invoice_uom') != pl.col('__expected_uom'))
    )
    invalid = is_txn & mismatch
    return [
        invalid.alias('__invalid_uom'),
    ]

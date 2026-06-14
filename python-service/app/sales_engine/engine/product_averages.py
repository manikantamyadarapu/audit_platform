"""Product-wise average unit rate: SUM(gross_amount) / SUM(quantity) per individual product SKU."""

from __future__ import annotations

import re
from typing import Any

import polars as pl

from app.utils.normalization_engine import normalize_strict_text


def _strict_unsigned_number_expr(raw: pl.Expr) -> pl.Expr:
    stripped = (
        raw.cast(pl.Utf8, strict=False)
        .fill_null('')
        .str.to_uppercase()
        .str.replace_all(',', '')
        .str.replace_all(r'[^0-9.\-]', '')
        .str.replace_all(r'\s+', '')
    )
    return (
        pl.when(raw.cast(pl.Utf8, strict=False).fill_null('').str.contains(r'[A-Za-z]'))
        .then(None)
        .when(stripped.str.len_chars() == 0)
        .then(None)
        .when(~stripped.str.contains(r'^\d+(\.\d+)?$'))
        .then(None)
        .otherwise(stripped.cast(pl.Float64, strict=False))
    )


def _product_family_bucket(product_norm: str) -> str:
    name = str(product_norm or '').upper().strip()
    if not name:
        return 'otherProducts'
    if re.match(r'^DI\.?\s*RA\b', name):
        return 'diRaProducts'
    if re.match(r'^DI\.?\s*RC\b', name):
        return 'diRcProducts'
    if 'FLAT POLKI' in name or name.startswith('FP '):
        return 'flatPolkiProducts'
    if 'GOLD' in name or re.search(r'\b\d{1,2}K\b', name):
        return 'goldProducts'
    if 'SILVER' in name:
        return 'silverProducts'
    if 'EMERALD' in name or re.match(r'^JEM\b', name):
        return 'emeraldProducts'
    if 'RUBY' in name or 'RUBIES' in name:
        return 'rubyProducts'
    if 'COLOR STONE' in name or 'COLOUR STONE' in name:
        return 'colorStoneProducts'
    if 'PEARL' in name:
        return 'pearlProducts'
    if name == 'CHAKRI' or name.startswith('CHAKRI '):
        return 'chakriProducts'
    if 'POLKI' in name:
        return 'polkiProducts'
    return 'otherProducts'


def build_product_average_verification_summary(
    records: list[dict[str, Any]],
    *,
    total_rows_processed: int = 0,
) -> dict[str, Any]:
    """Summarize distinct product SKU counts — never category/account totals."""
    buckets = {
        'diRaProducts': 0,
        'diRcProducts': 0,
        'flatPolkiProducts': 0,
        'polkiProducts': 0,
        'chakriProducts': 0,
        'goldProducts': 0,
        'silverProducts': 0,
        'emeraldProducts': 0,
        'rubyProducts': 0,
        'colorStoneProducts': 0,
        'pearlProducts': 0,
        'otherProducts': 0,
    }
    for row in records:
        product_norm = str(row.get('productNorm') or normalize_strict_text(row.get('product')) or '')
        bucket = _product_family_bucket(product_norm)
        buckets[bucket] += 1

    return {
        'totalRowsProcessed': int(total_rows_processed),
        'totalDistinctProducts': len(records),
        **buckets,
    }


def product_average_records_from_txn_frame(txn_df: pl.DataFrame) -> list[dict[str, Any]]:
    """
    Aggregate transaction rows by individual product SKU only.

    Average unit rate = SUM(gross_amount) / SUM(quantity), never AVG(unit_rate).
    Never grouped by sales account, category, or product family.
    """
    if txn_df.is_empty() or 'gross_amount' not in txn_df.columns:
        return []

    product_key_col = (
        '__product_norm'
        if '__product_norm' in txn_df.columns
        else 'product'
    )
    product_display_col = (
        '__original_product'
        if '__original_product' in txn_df.columns
        else 'product'
    )

    parsed_gross = _strict_unsigned_number_expr(
        pl.col('gross_amount').cast(pl.Utf8, strict=False)
    ).alias('__parsed_gross_amount')

    eligible = (
        txn_df.with_columns(parsed_gross)
        .filter(
            pl.col('__parsed_gross_amount').is_not_null()
            & pl.col('__parsed_quantity').is_not_null()
            & (pl.col('__parsed_quantity') > 0)
            & pl.col(product_key_col).is_not_null()
            & (pl.col(product_key_col).cast(pl.Utf8, strict=False).fill_null('') != '')
        )
    )
    if eligible.is_empty():
        return []

    sales_account_col = (
        '__original_sales_account'
        if '__original_sales_account' in eligible.columns
        else 'sales_account'
    )

    grouped = (
        eligible.group_by(product_key_col)
        .agg(
            pl.col('__parsed_gross_amount').sum().alias('total_gross'),
            pl.col('__parsed_quantity').sum().alias('total_qty'),
            pl.col(product_display_col).first().alias('product_display'),
            pl.col(sales_account_col).first().alias('sales_account_display'),
            pl.len().alias('transaction_count'),
        )
        .filter(pl.col('total_qty') > 0)
        .sort('product_display')
    )

    records: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for row in grouped.to_dicts():
        product_key = str(row[product_key_col]).strip()
        if not product_key or product_key in seen_keys:
            continue
        seen_keys.add(product_key)

        total_gross = float(row['total_gross'])
        total_qty = float(row['total_qty'])
        product = str(row.get('product_display') or product_key).strip() or product_key
        sales_account = str(row.get('sales_account_display') or '').strip()
        records.append(
            {
                'product': product,
                'productNorm': product_key,
                'salesAccount': sales_account,
                'totalQuantity': round(total_qty, 4),
                'totalGrossAmount': round(total_gross, 4),
                'averageRate': round(total_gross / total_qty, 4),
                'transactionCount': int(row['transaction_count']),
            }
        )

    records.sort(key=lambda item: (item['product'] or '').lower())
    return records

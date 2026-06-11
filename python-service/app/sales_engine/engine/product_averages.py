"""Product-wise average unit rate: SUM(gross_amount) / SUM(quantity)."""

from __future__ import annotations

from typing import Any

import polars as pl


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


def product_average_records_from_txn_frame(txn_df: pl.DataFrame) -> list[dict[str, Any]]:
    """
    Aggregate transaction rows by product.

    Average unit rate = SUM(gross_amount) / SUM(quantity), never AVG(unit_rate).
    """
    if txn_df.is_empty() or 'gross_amount' not in txn_df.columns:
        return []

    parsed_gross = _strict_unsigned_number_expr(
        pl.col('gross_amount').cast(pl.Utf8, strict=False)
    ).alias('__parsed_gross_amount')

    eligible = (
        txn_df.with_columns(parsed_gross)
        .filter(
            pl.col('__parsed_gross_amount').is_not_null()
            & pl.col('__parsed_quantity').is_not_null()
            & (pl.col('__parsed_quantity') > 0)
            & pl.col('__product_norm').is_not_null()
            & (pl.col('__product_norm') != '')
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
        eligible.group_by('__product_norm')
        .agg(
            pl.col('__parsed_gross_amount').sum().alias('total_gross'),
            pl.col('__parsed_quantity').sum().alias('total_qty'),
            pl.col('__original_product').first().alias('product_display')
            if '__original_product' in eligible.columns
            else pl.col('product').first().alias('product_display'),
            pl.col(sales_account_col).first().alias('sales_account_display'),
            pl.len().alias('transaction_count'),
        )
        .filter(pl.col('total_qty') > 0)
        .sort('product_display')
    )

    records: list[dict[str, Any]] = []
    for row in grouped.to_dicts():
        total_gross = float(row['total_gross'])
        total_qty = float(row['total_qty'])
        product_key = str(row['__product_norm'])
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
    return records

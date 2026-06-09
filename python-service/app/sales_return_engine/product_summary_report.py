"""Product coverage report for Sales Return Audit — reconciliation & business verification."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import polars as pl

from app.engines.vectorized_validation_engine import LoadedValidationSheet
from app.sales_engine.engine.vectorized_sales_engine import _strict_unsigned_number_expr
from app.sales_return_engine.engine.sales_return_average_engine import ProductAverage
from app.sales_return_engine.engine.sales_return_audit_engine import SalesReturnAuditEngine


@dataclass(slots=True)
class ProductRowStats:
    product_key: str
    product_display: str
    row_count: int
    total_gross_amount: float
    total_quantity: float


def collect_product_row_stats(
    engine: SalesReturnAuditEngine,
    loaded: LoadedValidationSheet,
) -> tuple[int, dict[str, ProductRowStats]]:
    """
    Count eligible transaction rows per normalized product (qty > 0, valid gross).
    Returns (total_enriched_rows, stats_by_product_key).
    """
    enriched = engine.sales_engine._enrich_sales_dataframe(loaded.dataframe)
    txn_mask = (
        pl.col('__is_transaction_row').fill_null(False)
        & ~pl.col('__is_blank_row').fill_null(False)
        & ~pl.col('__is_repeated_header').fill_null(False)
    )
    txn = enriched.filter(txn_mask)

    parsed_gross = _strict_unsigned_number_expr(
        pl.col('gross_amount').cast(pl.Utf8, strict=False)
    ).alias('__parsed_gross_amount')

    grouped = (
        txn.with_columns(parsed_gross)
        .filter(
            pl.col('__parsed_gross_amount').is_not_null()
            & pl.col('__parsed_quantity').is_not_null()
            & (pl.col('__parsed_quantity') > 0)
            & pl.col('__product_norm').is_not_null()
            & (pl.col('__product_norm') != '')
        )
        .group_by('__product_norm')
        .agg(
            pl.len().alias('row_count'),
            pl.col('__parsed_gross_amount').sum().alias('total_gross'),
            pl.col('__parsed_quantity').sum().alias('total_qty'),
            pl.col('__original_product').first().alias('product_display'),
        )
        .sort('row_count', descending=True)
    )

    stats: dict[str, ProductRowStats] = {}
    for row in grouped.to_dicts():
        key = str(row['__product_norm'])
        stats[key] = ProductRowStats(
            product_key=key,
            product_display=str(row.get('product_display') or key).strip() or key,
            row_count=int(row['row_count']),
            total_gross_amount=float(row['total_gross']),
            total_quantity=float(row['total_qty']),
        )
    return enriched.height, stats


def build_product_summary_report(
    *,
    sales_row_stats: dict[str, ProductRowStats],
    return_row_stats: dict[str, ProductRowStats],
    sales_averages: dict[str, ProductAverage],
    return_averages: dict[str, ProductAverage],
    sales_enriched_rows: int = 0,
    return_enriched_rows: int = 0,
) -> dict[str, Any]:
    sales_keys = set(sales_averages)
    return_keys = set(return_averages)
    matched = sorted(sales_keys & return_keys)
    missing_in_sales = sorted(return_keys - sales_keys)
    missing_in_return = sorted(sales_keys - return_keys)

    combined_row_counts: dict[str, dict[str, int]] = {}
    for key, stat in sales_row_stats.items():
        combined_row_counts.setdefault(key, {'sales': 0, 'return': 0, 'display': stat.product_display})
        combined_row_counts[key]['sales'] = stat.row_count
        combined_row_counts[key]['display'] = stat.product_display
    for key, stat in return_row_stats.items():
        combined_row_counts.setdefault(key, {'sales': 0, 'return': 0, 'display': stat.product_display})
        combined_row_counts[key]['return'] = stat.row_count
        if not combined_row_counts[key]['display']:
            combined_row_counts[key]['display'] = stat.product_display

    top_by_rows = sorted(
        combined_row_counts.items(),
        key=lambda item: item[1]['sales'] + item[1]['return'],
        reverse=True,
    )[:20]

    return {
        'salesEnrichedRows': sales_enriched_rows,
        'returnEnrichedRows': return_enriched_rows,
        'totalDistinctProductsInSales': len(sales_averages),
        'totalDistinctProductsInSalesReturn': len(return_averages),
        'totalDistinctProductsSalesRows': len(sales_row_stats),
        'totalDistinctProductsReturnRows': len(return_row_stats),
        'matchedProducts': len(matched),
        'missingInSales': len(missing_in_sales),
        'missingInReturn': len(missing_in_return),
        'matchedProductKeys': matched,
        'missingInSalesProducts': [
            {
                'productKey': key,
                'product': return_averages[key].product,
                'returnRowCount': return_row_stats.get(key, ProductRowStats(key, key, 0, 0, 0)).row_count,
                'returnAverageRate': round(return_averages[key].average_rate, 4),
                'currentAuditIssue': 'PRODUCT_NOT_FOUND_IN_SALES',
            }
            for key in missing_in_sales
        ],
        'missingInReturnProducts': [
            {
                'productKey': key,
                'product': sales_averages[key].product,
                'salesRowCount': sales_row_stats.get(key, ProductRowStats(key, key, 0, 0, 0)).row_count,
                'salesAverageRate': round(sales_averages[key].average_rate, 4),
                'currentAuditIssue': None,
                'note': 'Not compared — Sales Return Audit iterates return products only.',
            }
            for key in missing_in_return
        ],
        'top20ProductsByRowCount': [
            {
                'productKey': key,
                'product': data['display'],
                'salesRowCount': data['sales'],
                'returnRowCount': data['return'],
                'totalRowCount': data['sales'] + data['return'],
                'inSalesAverage': key in sales_averages,
                'inReturnAverage': key in return_averages,
                'matchStatus': (
                    'matched'
                    if key in matched
                    else 'missing_in_sales'
                    if key in missing_in_sales
                    else 'missing_in_return'
                    if key in missing_in_return
                    else 'unknown'
                ),
            }
            for key, data in top_by_rows
        ],
        'allProductsRowCounts': [
            {
                'productKey': key,
                'product': data['display'],
                'salesRowCount': data['sales'],
                'returnRowCount': data['return'],
                'matchStatus': (
                    'matched'
                    if key in matched
                    else 'missing_in_sales'
                    if key in missing_in_sales
                    else 'missing_in_return'
                ),
            }
            for key, data in sorted(
                combined_row_counts.items(),
                key=lambda item: item[1]['sales'] + item[1]['return'],
                reverse=True,
            )
        ],
    }


def generate_product_summary_from_files(
    sales_file_bytes: bytes,
    return_file_bytes: bytes,
) -> dict[str, Any]:
    engine = SalesReturnAuditEngine()
    sales_loaded = engine._load_sheet(sales_file_bytes, label='Sales audit file')
    return_loaded = engine._load_sheet(return_file_bytes, label='Sales return audit file', is_return=True)

    sales_enriched_rows, sales_row_stats = collect_product_row_stats(engine, sales_loaded)
    return_enriched_rows, return_row_stats = collect_product_row_stats(engine, return_loaded)
    sales_averages = engine._product_averages_from_loaded(sales_loaded)
    return_averages = engine._product_averages_from_loaded(return_loaded)

    return build_product_summary_report(
        sales_row_stats=sales_row_stats,
        return_row_stats=return_row_stats,
        sales_averages=sales_averages,
        return_averages=return_averages,
        sales_enriched_rows=sales_enriched_rows,
        return_enriched_rows=return_enriched_rows,
    )

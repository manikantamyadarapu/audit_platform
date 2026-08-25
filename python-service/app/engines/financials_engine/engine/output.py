"""Response builder for Financials Sales & Purchases pivots."""

from __future__ import annotations

from typing import Any

from app.engines.financials_engine.config.constants import PIVOT_COLUMNS, PIVOT_DISPLAY_HEADERS
from app.engines.financials_engine.config.product_rule_book import (
    map_pivots_to_closing_stock_categories,
)


def _pivot_totals(rows: list[dict[str, Any]]) -> tuple[float, float]:
    quantity = sum(float(row.get('sumOfQuantity') or 0) for row in rows)
    gross = sum(float(row.get('sumOfGross') or 0) for row in rows)
    return round(quantity, 4), round(gross, 4)


def build_financials_pivot_response(
    *,
    sales_pivot: list[dict[str, Any]],
    purchases_pivot: list[dict[str, Any]],
    sales_source_rows: int,
    purchases_source_rows: int,
    sales_file_name: str,
    purchases_file_name: str,
    load_ms: float,
) -> dict[str, Any]:
    sales_qty, sales_gross = _pivot_totals(sales_pivot)
    purchases_qty, purchases_gross = _pivot_totals(purchases_pivot)
    category_mapping = map_pivots_to_closing_stock_categories(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
    )

    return {
        'success': True,
        'salesPivot': sales_pivot,
        'purchasesPivot': purchases_pivot,
        'productsByCategory': category_mapping['productsByCategory'],
        'layoutByCategory': category_mapping['layoutByCategory'],
        'salesByCategory': category_mapping['salesByCategory'],
        'purchasesByCategory': category_mapping['purchasesByCategory'],
        'unmappedProducts': category_mapping['unmappedProducts'],
        'unmappedProductDetails': category_mapping.get('unmappedProductDetails', []),
        'closingStockCategories': category_mapping['categories'],
        'exportColumns': list(PIVOT_COLUMNS),
        'columnDisplayHeaders': dict(PIVOT_DISPLAY_HEADERS),
        'summary': {
            'salesFileName': sales_file_name,
            'purchasesFileName': purchases_file_name,
            'salesSourceRows': sales_source_rows,
            'purchasesSourceRows': purchases_source_rows,
            'salesProductCount': len(sales_pivot),
            'purchasesProductCount': len(purchases_pivot),
            'salesTotalQuantity': sales_qty,
            'salesTotalGross': sales_gross,
            'purchasesTotalQuantity': purchases_qty,
            'purchasesTotalGross': purchases_gross,
            'mappedProductCount': sum(
                len(rows) for rows in category_mapping['productsByCategory'].values()
            ),
            'unmappedProductCount': len(category_mapping['unmappedProducts']),
        },
        'totalRows': sales_source_rows + purchases_source_rows,
        'executionTiming': {
            'loadMs': load_ms,
        },
    }

"""Response builder for Financials Sales & Purchases pivots + Opening Stock."""

from __future__ import annotations

from typing import Any

from app.engines.financials_engine.config.constants import PIVOT_COLUMNS, PIVOT_DISPLAY_HEADERS
from app.engines.financials_engine.config.product_rule_book import (
    format_closing_stock_mapping_response,
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
    opening_pivot: list[dict[str, Any]] | None = None,
    validated_opening: list[dict[str, Any]] | None = None,
    opening_stock_report: dict[str, Any] | None = None,
    opening_qty_file_name: str | None = None,
    previous_year_file_name: str | None = None,
) -> dict[str, Any]:
    sales_qty, sales_gross = _pivot_totals(sales_pivot)
    purchases_qty, purchases_gross = _pivot_totals(purchases_pivot)
    opening_rows = list(opening_pivot or [])
    category_mapping = map_pivots_to_closing_stock_categories(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_rows,
    )
    mapping_payload = format_closing_stock_mapping_response(category_mapping)

    report = dict(opening_stock_report or {})
    report['mappedToClosingStock'] = category_mapping.get('mappedOpeningProducts', [])
    report['mappedToClosingStockCount'] = len(report['mappedToClosingStock'])
    report['unmappedToRuleBook'] = category_mapping.get('unmappedOpeningProducts', [])
    report['unmappedToRuleBookCount'] = len(report['unmappedToRuleBook'])

    opening_qty_total, opening_amt_total = _pivot_totals(opening_rows)

    return {
        'success': True,
        'salesPivot': sales_pivot,
        'purchasesPivot': purchases_pivot,
        'openingPivot': opening_rows,
        'validatedOpening': list(validated_opening or []),
        'openingStockReport': report,
        **mapping_payload,
        'exportColumns': list(PIVOT_COLUMNS),
        'columnDisplayHeaders': dict(PIVOT_DISPLAY_HEADERS),
        'summary': {
            'salesFileName': sales_file_name,
            'purchasesFileName': purchases_file_name,
            'openingQtyFileName': opening_qty_file_name,
            'previousYearFileName': previous_year_file_name,
            'salesSourceRows': sales_source_rows,
            'purchasesSourceRows': purchases_source_rows,
            'salesProductCount': len(sales_pivot),
            'purchasesProductCount': len(purchases_pivot),
            'salesTotalQuantity': sales_qty,
            'salesTotalGross': sales_gross,
            'purchasesTotalQuantity': purchases_qty,
            'purchasesTotalGross': purchases_gross,
            'openingProductCount': len(opening_rows),
            'openingTotalQuantity': opening_qty_total,
            'openingTotalAmount': opening_amt_total,
            'mappedProductCount': category_mapping.get('productsDisplayed', 0),
            'ruleBookFingerprint': category_mapping.get('ruleBookFingerprint'),
            'ruleBookProductCounts': category_mapping.get('ruleBookProductCounts', {}),
            'ruleBookProductTotal': category_mapping.get('ruleBookProductTotal', 0),
            'productsWithSalesData': category_mapping.get('productsWithSalesData', 0),
            'productsWithPurchaseData': category_mapping.get('productsWithPurchaseData', 0),
            'productsWithOpeningData': category_mapping.get('productsWithOpeningData', 0),
            'productsDisplayed': category_mapping.get('productsDisplayed', 0),
            'reconciliation': category_mapping.get('reconciliation', {}),
            'openingStockReport': report,
            'unmappedProductCount': len(category_mapping['unmappedProducts']),
        },
        'totalRows': sales_source_rows + purchases_source_rows,
        'errorRows': len(category_mapping['unmappedProducts'])
        + int(report.get('unmatchedCount') or report.get('missingFromPreviousYearFileCount') or 0),
        'fileType': 'closing_stock',
        'auditKey': 'FINANCIALS_PIVOT',
        'closingStockMeasures': {
            'complete': False,
            'implemented': [
                'openingQty',
                'openingAmt',
                'purchasesQty',
                'purchasesAmt',
                'salesQty',
                'salesAmt',
            ],
            'pending': [
                'receiptsQty',
                'receiptsAmount',
                'issuesQty',
                'issuesAmount',
                'averageRate',
                'closingQty',
                'closingAmount',
                'grossProfit',
                'deviation',
            ],
            'message': (
                'Closing Stock measure calculations (receipts, issues, average rate, '
                'closing, GP, deviation) are not implemented yet.'
            ),
        },
        'executionTiming': {
            'loadMs': load_ms,
        },
    }

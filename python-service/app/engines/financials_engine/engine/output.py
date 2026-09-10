"""Response builder for Financials pivots + Opening Stock + MR/DC location pivots."""

from __future__ import annotations

from typing import Any

from app.engines.financials_engine.config.constants import PIVOT_COLUMNS, PIVOT_DISPLAY_HEADERS
from app.engines.financials_engine.config.product_rule_book import (
    format_closing_stock_mapping_response,
    map_pivots_to_closing_stock_categories,
)
from app.engines.financials_engine.engine.mr_dc_pivots import PIVOT_KEYS


def _pivot_totals(rows: list[dict[str, Any]]) -> tuple[float, float]:
    quantity = sum(float(row.get('sumOfQuantity') or 0) for row in rows)
    gross = sum(float(row.get('sumOfGross') or 0) for row in rows)
    return round(quantity, 4), round(gross, 4)


def _empty_transfer_report() -> dict[str, Any]:
    return {
        'sourceRowCount': 0,
        'classifiedRowCount': 0,
        'unclassifiedCount': 0,
        'locationCounts': {key: 0 for key in PIVOT_KEYS},
        'unclassifiedRows': [],
    }


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
    mr_pivots: dict[str, list[dict[str, Any]]] | None = None,
    dc_pivots: dict[str, list[dict[str, Any]]] | None = None,
    mr_report: dict[str, Any] | None = None,
    dc_report: dict[str, Any] | None = None,
    mr_file_name: str | None = None,
    dc_file_name: str | None = None,
    mr_source_rows: int = 0,
    dc_source_rows: int = 0,
) -> dict[str, Any]:
    sales_qty, sales_gross = _pivot_totals(sales_pivot)
    purchases_qty, purchases_gross = _pivot_totals(purchases_pivot)
    opening_rows = list(opening_pivot or [])
    category_mapping = map_pivots_to_closing_stock_categories(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_rows,
        mr_pivots=mr_pivots,
        dc_pivots=dc_pivots,
    )
    mapping_payload = format_closing_stock_mapping_response(category_mapping)

    report = dict(opening_stock_report or {})
    report['mappedToClosingStock'] = category_mapping.get('mappedOpeningProducts', [])
    report['mappedToClosingStockCount'] = len(report['mappedToClosingStock'])
    report['unmappedToRuleBook'] = category_mapping.get('unmappedOpeningProducts', [])
    report['unmappedToRuleBookCount'] = len(report['unmappedToRuleBook'])

    mr_rep = dict(mr_report or _empty_transfer_report())
    dc_rep = dict(dc_report or _empty_transfer_report())
    if mr_source_rows and not mr_rep.get('sourceRowCount'):
        mr_rep['sourceRowCount'] = mr_source_rows
    if dc_source_rows and not dc_rep.get('sourceRowCount'):
        dc_rep['sourceRowCount'] = dc_source_rows

    opening_qty_total, opening_amt_total = _pivot_totals(opening_rows)
    mr_tree = {key: list((mr_pivots or {}).get(key) or []) for key in PIVOT_KEYS}
    dc_tree = {key: list((dc_pivots or {}).get(key) or []) for key in PIVOT_KEYS}

    mr_classified = int(mr_rep.get('classifiedRowCount') or 0)
    mr_unclassified = int(mr_rep.get('unclassifiedCount') or 0)
    dc_classified = int(dc_rep.get('classifiedRowCount') or 0)
    dc_unclassified = int(dc_rep.get('unclassifiedCount') or 0)
    opening_unmatched = int(report.get('unmatchedCount') or 0)
    opening_manual = int(
        report.get('manualMappingRequiredCount')
        or report.get('previousYearMappingRequiredCount')
        or 0
    )
    unmapped_products = len(category_mapping['unmappedProducts'])

    return {
        'success': True,
        'salesPivot': sales_pivot,
        'purchasesPivot': purchases_pivot,
        'openingPivot': opening_rows,
        'validatedOpening': list(validated_opening or []),
        'openingStockReport': report,
        'mrPivots': mr_tree,
        'dcPivots': dc_tree,
        'mrReport': mr_rep,
        'dcReport': dc_rep,
        **mapping_payload,
        'exportColumns': list(PIVOT_COLUMNS),
        'columnDisplayHeaders': dict(PIVOT_DISPLAY_HEADERS),
        'summary': {
            'salesFileName': sales_file_name,
            'purchasesFileName': purchases_file_name,
            'openingQtyFileName': opening_qty_file_name,
            'previousYearFileName': previous_year_file_name,
            'mrFileName': mr_file_name,
            'dcFileName': dc_file_name,
            'mrSourceRows': mr_rep.get('sourceRowCount', mr_source_rows),
            'dcSourceRows': dc_rep.get('sourceRowCount', dc_source_rows),
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
            'mrClassifiedRows': mr_classified,
            'mrUnclassifiedRows': mr_unclassified,
            'dcClassifiedRows': dc_classified,
            'dcUnclassifiedRows': dc_unclassified,
            'openingUnmatchedCount': opening_unmatched,
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
            'mrReport': mr_rep,
            'dcReport': dc_rep,
            'unmappedProductCount': unmapped_products,
        },
        'totalRows': sales_source_rows
        + purchases_source_rows
        + int(mr_rep.get('sourceRowCount') or mr_source_rows or 0)
        + int(dc_rep.get('sourceRowCount') or dc_source_rows or 0),
        'errorRows': unmapped_products
        + opening_unmatched
        + opening_manual
        + mr_unclassified
        + dc_unclassified,
        'fileType': 'closing_stock',
        'auditKey': 'FINANCIALS_PIVOT',
        'executionTiming': {
            'loadMs': load_ms,
        },
    }

"""Response builder for Financials pivots + Opening + Receipts/Issues."""

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
    receipts_pivot: list[dict[str, Any]] | None = None,
    issues_pivot: list[dict[str, Any]] | None = None,
    receipts_report: dict[str, Any] | None = None,
    issues_report: dict[str, Any] | None = None,
    classification_config: dict[str, Any] | None = None,
    mr_file_name: str | None = None,
    dc_file_name: str | None = None,
) -> dict[str, Any]:
    sales_qty, sales_gross = _pivot_totals(sales_pivot)
    purchases_qty, purchases_gross = _pivot_totals(purchases_pivot)
    opening_rows = list(opening_pivot or [])
    receipts_rows = list(receipts_pivot or [])
    issues_rows = list(issues_pivot or [])
    category_mapping = map_pivots_to_closing_stock_categories(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_rows,
        receipts_pivot=receipts_rows,
        issues_pivot=issues_rows,
    )
    mapping_payload = format_closing_stock_mapping_response(category_mapping)

    report = dict(opening_stock_report or {})
    report['mappedToClosingStock'] = category_mapping.get('mappedOpeningProducts', [])
    report['mappedToClosingStockCount'] = len(report['mappedToClosingStock'])
    report['unmappedToRuleBook'] = category_mapping.get('unmappedOpeningProducts', [])
    report['unmappedToRuleBookCount'] = len(report['unmappedToRuleBook'])

    receipts_rep = dict(receipts_report or {})
    issues_rep = dict(issues_report or {})
    receipts_rep['unmappedToRuleBook'] = category_mapping.get('unmappedReceiptsProducts', [])
    receipts_rep['unmappedToRuleBookCount'] = len(receipts_rep['unmappedToRuleBook'])
    issues_rep['unmappedToRuleBook'] = category_mapping.get('unmappedIssuesProducts', [])
    issues_rep['unmappedToRuleBookCount'] = len(issues_rep['unmappedToRuleBook'])

    opening_qty_total, opening_amt_total = _pivot_totals(opening_rows)
    receipts_qty_total, receipts_amt_total = _pivot_totals(receipts_rows)
    issues_qty_total, issues_amt_total = _pivot_totals(issues_rows)
    net_movement = category_mapping.get('netMovement') or {}

    return {
        'success': True,
        'salesPivot': sales_pivot,
        'purchasesPivot': purchases_pivot,
        'openingPivot': opening_rows,
        'receiptsPivot': receipts_rows,
        'issuesPivot': issues_rows,
        'validatedOpening': list(validated_opening or []),
        'openingStockReport': report,
        'receiptsReport': receipts_rep,
        'issuesReport': issues_rep,
        'classificationConfig': dict(classification_config or {}),
        'netMovement': net_movement,
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
            'receiptsBucketRowCount': len(receipts_rows),
            'issuesBucketRowCount': len(issues_rows),
            'receiptsTotalQuantity': receipts_qty_total,
            'receiptsTotalGross': receipts_amt_total,
            'issuesTotalQuantity': issues_qty_total,
            'issuesTotalGross': issues_amt_total,
            'receiptsClassifiedRows': receipts_rep.get('classifiedRowCount', 0),
            'receiptsUnclassifiedRows': receipts_rep.get('unclassifiedCount', 0),
            'issuesClassifiedRows': issues_rep.get('classifiedRowCount', 0),
            'issuesUnclassifiedRows': issues_rep.get('unclassifiedCount', 0),
            'netMovementQty': net_movement.get('netMovementQty'),
            'netMovementAmt': net_movement.get('netMovementAmt'),
            'netMovementFormula': net_movement.get('formula'),
            'mappedProductCount': category_mapping.get('productsDisplayed', 0),
            'ruleBookFingerprint': category_mapping.get('ruleBookFingerprint'),
            'ruleBookProductCounts': category_mapping.get('ruleBookProductCounts', {}),
            'ruleBookProductTotal': category_mapping.get('ruleBookProductTotal', 0),
            'productsWithSalesData': category_mapping.get('productsWithSalesData', 0),
            'productsWithPurchaseData': category_mapping.get('productsWithPurchaseData', 0),
            'productsWithOpeningData': category_mapping.get('productsWithOpeningData', 0),
            'productsWithReceiptsData': category_mapping.get('productsWithReceiptsData', 0),
            'productsWithIssuesData': category_mapping.get('productsWithIssuesData', 0),
            'productsDisplayed': category_mapping.get('productsDisplayed', 0),
            'reconciliation': category_mapping.get('reconciliation', {}),
            'openingStockReport': report,
            'receiptsReport': receipts_rep,
            'issuesReport': issues_rep,
            'unmappedProductCount': len(category_mapping['unmappedProducts']),
        },
        'totalRows': sales_source_rows + purchases_source_rows,
        'errorRows': len(category_mapping['unmappedProducts'])
        + int(report.get('unmatchedCount') or report.get('missingFromPreviousYearFileCount') or 0)
        + int(receipts_rep.get('unclassifiedCount') or 0)
        + int(issues_rep.get('unclassifiedCount') or 0),
        'fileType': 'closing_stock',
        'auditKey': 'FINANCIALS_PIVOT',
        'executionTiming': {
            'loadMs': load_ms,
        },
    }

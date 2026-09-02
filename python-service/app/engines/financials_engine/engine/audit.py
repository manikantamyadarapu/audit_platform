"""Financials first audit: Sales, Purchases pivots + Opening Stock mapping."""

from __future__ import annotations

from time import perf_counter
from typing import Any

from app.engines.financials_engine.engine.calculator import build_product_pivot
from app.engines.financials_engine.engine.opening_stock import validate_opening_stock
from app.engines.financials_engine.engine.output import build_financials_pivot_response
from app.engines.financials_engine.parsers.opening_stock_loader import (
    load_opening_quantity_workbook,
    load_previous_year_opening_stock,
)
from app.engines.financials_engine.parsers.workbook_loader import load_financials_workbook
from app.utils.logger import get_logger


def validated_opening_to_pivot(validated_opening: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert Opening Stock rows into pivot-shaped records for layout mapping."""
    return [
        {
            'product': str(row.get('product') or '').strip(),
            'ruleBookProduct': row.get('ruleBookProduct'),
            'category': row.get('category'),
            'subcategory': row.get('subcategory'),
            'status': row.get('status'),
            'sumOfQuantity': row.get('openingQty'),
            'sumOfGross': row.get('openingAmt'),
        }
        for row in validated_opening
        if str(row.get('product') or '').strip()
        and (row.get('openingQty') is not None or row.get('openingAmt') is not None)
    ]


class FinancialsPivotAudit:
    """Build Sales/Purchases pivots and Opening Stock for Closing Stock."""

    def __init__(self, log: Any | None = None) -> None:
        self._log = log or get_logger()

    def process(
        self,
        sales_file_name: str,
        sales_bytes: bytes,
        purchases_file_name: str,
        purchases_bytes: bytes,
        opening_qty_file_name: str = '',
        opening_qty_bytes: bytes | None = None,
        previous_year_file_name: str = '',
        previous_year_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        started = perf_counter()

        sales_rows, _ = load_financials_workbook(
            sales_bytes,
            sales_file_name,
            source_label='Sales',
        )
        purchases_rows, _ = load_financials_workbook(
            purchases_bytes,
            purchases_file_name,
            source_label='Purchases',
        )

        sales_pivot = build_product_pivot(sales_rows)
        purchases_pivot = build_product_pivot(purchases_rows)

        opening_report: dict[str, Any] = {}
        opening_pivot: list[dict[str, Any]] = []
        validated_opening: list[dict[str, Any]] = []

        if opening_qty_bytes and previous_year_bytes:
            qty_rows = load_opening_quantity_workbook(
                opening_qty_bytes,
                opening_qty_file_name or 'opening-quantity.xlsx',
            )
            prev_payload = load_previous_year_opening_stock(
                previous_year_bytes,
                previous_year_file_name or 'previous-year-closing.xlsx',
                log=self._log,
            )
            opening_result = validate_opening_stock(
                quantity_rows=qty_rows,
                previous_year_sheets=prev_payload['productIndex'],
                subcategory_products=prev_payload.get('subcategoryProducts'),
                sheet_products=prev_payload.get('sheetProducts'),
                log=self._log,
            )
            validated_opening = list(opening_result.get('validatedOpening') or [])
            opening_report = dict(opening_result.get('report') or {})
            opening_pivot = validated_opening_to_pivot(validated_opening)
            self._log.info(
                'Opening Stock mapping: qty_products={} prev_index={} exact_matched={} '
                'fallback_matched={} unmatched={} manual_mapping_required={}',
                len(qty_rows),
                len(prev_payload.get('productIndex') or {}),
                opening_report.get('exactMatchedCount', 0),
                opening_report.get('fallbackMatchedCount', 0),
                opening_report.get('unmatchedCount', 0),
                opening_report.get('manualMappingRequiredCount', 0),
            )

        self._log.info(
            'Financials pivot: sales {} rows → {} products; purchases {} rows → {} products; '
            'opening rows {}',
            len(sales_rows),
            len(sales_pivot),
            len(purchases_rows),
            len(purchases_pivot),
            len(opening_pivot),
        )

        load_ms = (perf_counter() - started) * 1000
        return build_financials_pivot_response(
            sales_pivot=sales_pivot,
            purchases_pivot=purchases_pivot,
            opening_pivot=opening_pivot,
            validated_opening=validated_opening,
            opening_stock_report=opening_report,
            sales_source_rows=len(sales_rows),
            purchases_source_rows=len(purchases_rows),
            sales_file_name=sales_file_name,
            purchases_file_name=purchases_file_name,
            opening_qty_file_name=opening_qty_file_name or None,
            previous_year_file_name=previous_year_file_name or None,
            load_ms=load_ms,
        )

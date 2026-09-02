"""Financials audit: Sales, Purchases, Opening Stock, Receipts (MR), Issues (DC)."""

from __future__ import annotations

from time import perf_counter
from typing import Any

from app.engines.financials_engine.engine.calculator import build_product_pivot
from app.engines.financials_engine.engine.opening_stock import validate_opening_stock
from app.engines.financials_engine.engine.output import build_financials_pivot_response
from app.engines.financials_engine.engine.receipts_issues import process_mr_dc_ledgers
from app.engines.financials_engine.parsers.mr_dc_loader import load_transfer_workbook
from app.engines.financials_engine.parsers.opening_stock_loader import (
    load_opening_quantity_workbook,
    load_previous_year_product_sheets,
)
from app.engines.financials_engine.parsers.workbook_loader import load_financials_workbook
from app.utils.logger import get_logger


def validated_opening_to_pivot(validated_opening: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert Opening Stock rows into pivot-shaped records for Rule Book mapping."""
    return [
        {
            'product': str(row.get('product') or '').strip(),
            'sumOfQuantity': row.get('openingQty'),
            'sumOfGross': row.get('openingAmt'),
        }
        for row in validated_opening
        if str(row.get('product') or '').strip()
        and (row.get('openingQty') is not None or row.get('openingAmt') is not None)
    ]


class FinancialsPivotAudit:
    """Build Sales/Purchases/Opening/Receipts/Issues for Closing Stock."""

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
        mr_file_name: str = '',
        mr_bytes: bytes | None = None,
        dc_file_name: str = '',
        dc_bytes: bytes | None = None,
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
            prev_sheets = load_previous_year_product_sheets(
                previous_year_bytes,
                previous_year_file_name or 'previous-year-closing.xlsx',
                log=self._log,
            )
            opening_result = validate_opening_stock(
                quantity_rows=qty_rows,
                previous_year_sheets=prev_sheets,
                log=self._log,
            )
            validated_opening = list(opening_result.get('validatedOpening') or [])
            opening_report = dict(opening_result.get('report') or {})
            opening_pivot = validated_opening_to_pivot(validated_opening)
            self._log.info(
                'Opening Stock mapping: qty_products={} prev_sheets={} matched={} unmatched={}',
                len(qty_rows),
                len(prev_sheets),
                opening_report.get('matchedCount', 0),
                opening_report.get('unmatchedCount', 0),
            )

        receipts_pivot: list[dict[str, Any]] = []
        issues_pivot: list[dict[str, Any]] = []
        receipts_report: dict[str, Any] = {}
        issues_report: dict[str, Any] = {}
        classification_config: dict[str, Any] = {}
        mr_meta: dict[str, Any] = {}
        dc_meta: dict[str, Any] = {}

        if mr_bytes and dc_bytes:
            mr_rows, _, mr_meta = load_transfer_workbook(
                mr_bytes,
                mr_file_name or 'MR.xlsx',
                source_label='Material Receipts (MR)',
            )
            dc_rows, _, dc_meta = load_transfer_workbook(
                dc_bytes,
                dc_file_name or 'DC.xlsx',
                source_label='Delivery Challans (DC)',
            )
            transfer = process_mr_dc_ledgers(
                mr_rows=mr_rows,
                dc_rows=dc_rows,
                log=self._log,
            )
            receipts_pivot = list(transfer.get('receiptsPivot') or [])
            issues_pivot = list(transfer.get('issuesPivot') or [])
            receipts_report = dict(transfer.get('receiptsReport') or {})
            issues_report = dict(transfer.get('issuesReport') or {})
            classification_config = dict(transfer.get('classificationConfig') or {})
            receipts_report['sourceRows'] = len(mr_rows)
            issues_report['sourceRows'] = len(dc_rows)
            receipts_report['classificationColumns'] = mr_meta.get('classificationColumns') or []
            issues_report['classificationColumns'] = dc_meta.get('classificationColumns') or []

        self._log.info(
            'Financials pivot: sales {} rows → {} products; purchases {} rows → {} products; '
            'opening rows {}; receipts buckets {}; issues buckets {}',
            len(sales_rows),
            len(sales_pivot),
            len(purchases_rows),
            len(purchases_pivot),
            len(opening_pivot),
            len(receipts_pivot),
            len(issues_pivot),
        )

        load_ms = (perf_counter() - started) * 1000.0
        return build_financials_pivot_response(
            sales_pivot=sales_pivot,
            purchases_pivot=purchases_pivot,
            sales_source_rows=len(sales_rows),
            purchases_source_rows=len(purchases_rows),
            sales_file_name=sales_file_name,
            purchases_file_name=purchases_file_name,
            load_ms=load_ms,
            opening_pivot=opening_pivot,
            validated_opening=validated_opening,
            opening_stock_report=opening_report,
            opening_qty_file_name=opening_qty_file_name or None,
            previous_year_file_name=previous_year_file_name or None,
            receipts_pivot=receipts_pivot,
            issues_pivot=issues_pivot,
            receipts_report=receipts_report,
            issues_report=issues_report,
            classification_config=classification_config,
            mr_file_name=mr_file_name or None,
            dc_file_name=dc_file_name or None,
        )

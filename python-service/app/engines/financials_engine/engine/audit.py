"""Financials first audit: Sales, Purchases pivots + Opening Stock mapping."""

from __future__ import annotations

from time import perf_counter
from typing import Any

from app.engines.financials_engine.engine.calculator import (
    apply_same_product_adjustment,
    build_product_pivot,
)
from app.engines.financials_engine.engine.mr_dc_pivots import build_mr_dc_pivot_payload
from app.engines.financials_engine.engine.opening_stock import validate_opening_stock
from app.engines.financials_engine.engine.output import build_financials_pivot_response
from app.engines.financials_engine.parsers.mr_dc_loader import load_transfer_workbook
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
            'sheetName': row.get('sheetName'),
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
                dedicated_product_sheets=prev_payload.get('dedicatedProductSheets') or [],
                trading_sheet_products=prev_payload.get('tradingSheetProducts') or [],
                log=self._log,
            )
            validated_opening = list(opening_result.get('validatedOpening') or [])
            opening_report = dict(opening_result.get('report') or {})
            opening_pivot = validated_opening_to_pivot(validated_opening)
            self._log.info(
                'Opening Stock mapping: qty_products={} prev_index={} exact_matched={} '
                'fallback_matched={} unmatched={} qty_mismatch={} mapping_required={}',
                len(qty_rows),
                len(prev_payload.get('productIndex') or {}),
                opening_report.get('exactMatchedCount', 0),
                opening_report.get('fallbackMatchedCount', 0),
                opening_report.get('unmatchedCount', 0),
                opening_report.get('quantityMismatchCount', 0),
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

        mr_rows: list[dict[str, Any]] = []
        dc_rows: list[dict[str, Any]] = []
        if mr_bytes:
            mr_rows = load_transfer_workbook(
                mr_bytes,
                mr_file_name or 'mr.xlsx',
                source_label='MR',
            )
        if dc_bytes:
            dc_rows = load_transfer_workbook(
                dc_bytes,
                dc_file_name or 'dc.xlsx',
                source_label='DC',
            )
        mr_dc_pivots = build_mr_dc_pivot_payload(mr_rows=mr_rows, dc_rows=dc_rows)
        self._log.info(
            'MR/DC pivots: mr_rows={} dc_rows={} mr_classified={} mr_unclassified={} '
            'dc_classified={} dc_unclassified={}',
            len(mr_rows),
            len(dc_rows),
            (mr_dc_pivots.get('mrReport') or {}).get('classifiedRowCount', 0),
            (mr_dc_pivots.get('mrReport') or {}).get('unclassifiedCount', 0),
            (mr_dc_pivots.get('dcReport') or {}).get('classifiedRowCount', 0),
            (mr_dc_pivots.get('dcReport') or {}).get('unclassifiedCount', 0),
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
            mr_pivots=mr_dc_pivots['mrPivots'],
            dc_pivots=mr_dc_pivots['dcPivots'],
            mr_report=mr_dc_pivots.get('mrReport'),
            dc_report=mr_dc_pivots.get('dcReport'),
            mr_file_name=mr_file_name or None,
            dc_file_name=dc_file_name or None,
            mr_source_rows=len(mr_rows),
            dc_source_rows=len(dc_rows),
            load_ms=load_ms,
        )

    def process_sales_purchases_pivots(
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
        """Sales and Purchases pivots, plus the same Opening Stock mapping as Basheerbagh.

        Does not build MR, DC, Closing Stock, Trading, or Abstract.
        """
        from app.engines.financials_engine.engine.output import build_sales_purchases_pivot_response

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

        opening_report: dict[str, Any] | None = None
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
                dedicated_product_sheets=prev_payload.get('dedicatedProductSheets') or [],
                trading_sheet_products=prev_payload.get('tradingSheetProducts') or [],
                log=self._log,
            )
            validated_opening = list(opening_result.get('validatedOpening') or [])
            opening_report = dict(opening_result.get('report') or {})
            opening_pivot = validated_opening_to_pivot(validated_opening)
            self._log.info(
                'Opening Stock mapping: qty_products={} prev_index={} exact_matched={} '
                'fallback_matched={} unmatched={} qty_mismatch={} mapping_required={}',
                len(qty_rows),
                len(prev_payload.get('productIndex') or {}),
                opening_report.get('exactMatchedCount', 0),
                opening_report.get('fallbackMatchedCount', 0),
                opening_report.get('unmatchedCount', 0),
                opening_report.get('quantityMismatchCount', 0),
                opening_report.get('manualMappingRequiredCount', 0),
            )

        self._log.info(
            'Financials sales/purchases pivots: sales {} rows → {} products; purchases {} rows → {} products; opening rows {}',
            len(sales_rows),
            len(sales_pivot),
            len(purchases_rows),
            len(purchases_pivot),
            len(opening_pivot),
        )
        return build_sales_purchases_pivot_response(
            sales_pivot=sales_pivot,
            purchases_pivot=purchases_pivot,
            sales_source_rows=len(sales_rows),
            purchases_source_rows=len(purchases_rows),
            sales_file_name=sales_file_name,
            purchases_file_name=purchases_file_name,
            load_ms=(perf_counter() - started) * 1000,
            opening_pivot=opening_pivot,
            validated_opening=validated_opening,
            opening_stock_report=opening_report,
            opening_qty_file_name=opening_qty_file_name or None,
            previous_year_file_name=previous_year_file_name or None,
        )

    def _load_adjustment_pivot(
        self,
        file_bytes: bytes | None,
        file_name: str,
        source_label: str,
    ) -> list[dict[str, Any]]:
        if not file_bytes:
            return []
        rows, _headers = load_financials_workbook(
            file_bytes,
            file_name or f'{source_label}.xlsx',
            source_label=source_label,
        )
        return build_product_pivot(rows)

    def process_jubilee_hills(
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
        sales_return_file_name: str = '',
        sales_return_bytes: bytes | None = None,
        purchase_return_file_name: str = '',
        purchase_return_bytes: bytes | None = None,
        credit_note_file_name: str = '',
        credit_note_bytes: bytes | None = None,
        debit_note_file_name: str = '',
        debit_note_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        """Jubilee Hills only. Basheerbagh and Kokapet keep using process()."""
        base = self.process(
            sales_file_name,
            sales_bytes,
            purchases_file_name,
            purchases_bytes,
            opening_qty_file_name=opening_qty_file_name,
            opening_qty_bytes=opening_qty_bytes,
            previous_year_file_name=previous_year_file_name,
            previous_year_bytes=previous_year_bytes,
            mr_file_name=mr_file_name,
            mr_bytes=mr_bytes,
            dc_file_name=dc_file_name,
            dc_bytes=dc_bytes,
        )
        sales_return_pivot = self._load_adjustment_pivot(
            sales_return_bytes,
            sales_return_file_name,
            'Sales Return',
        )
        purchase_return_pivot = self._load_adjustment_pivot(
            purchase_return_bytes,
            purchase_return_file_name,
            'Purchase Return',
        )
        credit_note_pivot = self._load_adjustment_pivot(
            credit_note_bytes,
            credit_note_file_name,
            'Credit notes from suppliers',
        )
        debit_note_pivot = self._load_adjustment_pivot(
            debit_note_bytes,
            debit_note_file_name,
            'Debit notes from suppliers',
        )
        sales_pivot = apply_same_product_adjustment(
            list(base.get('salesPivot') or []),
            [(sales_return_pivot, -1)],
        )
        purchases_pivot = apply_same_product_adjustment(
            list(base.get('purchasesPivot') or []),
            [
                (purchase_return_pivot, -1),
                (credit_note_pivot, -1),
                (debit_note_pivot, 1),
            ],
        )
        summary = dict(base.get('summary') or {})
        rebuilt = build_financials_pivot_response(
            sales_pivot=sales_pivot,
            purchases_pivot=purchases_pivot,
            sales_source_rows=int(summary.get('salesSourceRows') or 0),
            purchases_source_rows=int(summary.get('purchasesSourceRows') or 0),
            sales_file_name=sales_file_name,
            purchases_file_name=purchases_file_name,
            load_ms=float((base.get('executionTiming') or {}).get('loadMs') or 0),
            opening_pivot=list(base.get('openingPivot') or []),
            validated_opening=list(base.get('validatedOpening') or []),
            opening_stock_report=dict(base.get('openingStockReport') or {}),
            opening_qty_file_name=opening_qty_file_name or None,
            previous_year_file_name=previous_year_file_name or None,
            mr_pivots=base.get('mrPivots'),
            dc_pivots=base.get('dcPivots'),
            mr_report=base.get('mrReport'),
            dc_report=base.get('dcReport'),
            mr_file_name=mr_file_name or None,
            dc_file_name=dc_file_name or None,
            mr_source_rows=int(summary.get('mrSourceRows') or 0),
            dc_source_rows=int(summary.get('dcSourceRows') or 0),
        )
        rebuilt['salesReturnPivot'] = sales_return_pivot
        rebuilt['purchaseReturnPivot'] = purchase_return_pivot
        rebuilt['supplierCreditNotePivot'] = credit_note_pivot
        rebuilt['supplierDebitNotePivot'] = debit_note_pivot
        rebuilt['branch'] = 'jubilee-hills'
        return rebuilt

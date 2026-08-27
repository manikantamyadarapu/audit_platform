"""Financials first audit: independent Sales and Purchases product pivots."""

from __future__ import annotations

from time import perf_counter
from typing import Any

from app.engines.financials_engine.engine.calculator import build_product_pivot
from app.engines.financials_engine.engine.output import build_financials_pivot_response
from app.engines.financials_engine.parsers.workbook_loader import load_financials_workbook
from app.utils.logger import get_logger


class FinancialsPivotAudit:
    """Build separate product-wise SUM(Quantity) / SUM(Gross Amount) pivots."""

    def __init__(self, log: Any | None = None) -> None:
        self._log = log or get_logger()

    def process(
        self,
        sales_file_name: str,
        sales_bytes: bytes,
        purchases_file_name: str,
        purchases_bytes: bytes,
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

        self._log.info(
            'Financials pivot: sales {} rows → {} products; purchases {} rows → {} products',
            len(sales_rows),
            len(sales_pivot),
            len(purchases_rows),
            len(purchases_pivot),
        )

        load_ms = (perf_counter() - started) * 1000
        return build_financials_pivot_response(
            sales_pivot=sales_pivot,
            purchases_pivot=purchases_pivot,
            sales_source_rows=len(sales_rows),
            purchases_source_rows=len(purchases_rows),
            sales_file_name=sales_file_name,
            purchases_file_name=purchases_file_name,
            load_ms=load_ms,
        )

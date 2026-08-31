"""Financials Closing Stock processor (four-file orchestration wrapper)."""

from __future__ import annotations

from typing import Any

from app.engines.financials_engine.engine.audit import FinancialsPivotAudit
from app.utils.logger import get_logger


class FinancialsClosingStockProcessor:
    """
    Thin processor wrapper matching other HASS audit engines.

    Closing Stock is multi-file (Sales + Purchases + Opening Quantity +
    Previous Year Closing), invoked from the financials router.
    """

    def __init__(self) -> None:
        self._log = get_logger()
        try:
            self.audit = FinancialsPivotAudit()
        except Exception as exc:
            self._log.error('Failed to initialize FinancialsPivotAudit: {}', exc)
            raise

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
        try:
            return self.audit.process(
                sales_file_name,
                sales_bytes,
                purchases_file_name,
                purchases_bytes,
                opening_qty_file_name=opening_qty_file_name,
                opening_qty_bytes=opening_qty_bytes,
                previous_year_file_name=previous_year_file_name,
                previous_year_bytes=previous_year_bytes,
            )
        except Exception as exc:
            self._log.error('Closing Stock processing failed: {}', exc)
            raise

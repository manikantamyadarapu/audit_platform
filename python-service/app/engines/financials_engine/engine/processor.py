"""Financials Closing Stock processor (dual-file orchestration wrapper)."""

from __future__ import annotations

from typing import Any

from app.engines.financials_engine.engine.audit import FinancialsPivotAudit
from app.utils.logger import get_logger


class FinancialsClosingStockProcessor:
    """
    Thin processor wrapper matching other HASS audit engines.

    Closing Stock is dual-file (Sales + Purchases), so it is invoked from the
    financials router rather than the single-file engine factory. Calculation
    rules remain stubbed in ``rules.py`` until the Rule Book logic is plugged in.
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
    ) -> dict[str, Any]:
        try:
            return self.audit.process(
                sales_file_name,
                sales_bytes,
                purchases_file_name,
                purchases_bytes,
            )
        except Exception as exc:
            self._log.error('Closing Stock processing failed: {}', exc)
            raise

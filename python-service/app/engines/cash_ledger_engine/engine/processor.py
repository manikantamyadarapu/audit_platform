"""Cash Ledger Audit processor."""

from typing import Any

from app.engines.cash_ledger_engine.engine.audit import CashLedgerAudit
from app.core.base_processor import BaseProcessor
from app.utils.logger import get_logger


class CashLedgerProcessor(BaseProcessor):
    """Validate cash ledger for negative balances, large payments, and large receipts."""

    def __init__(self) -> None:
        self._log = get_logger()
        try:
            self.audit = CashLedgerAudit()
        except Exception as exc:
            self._log.error(f"Failed to initialize CashLedgerAudit: {exc}")
            raise

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        """Process cash ledger Excel file and run audit rules."""
        try:
            return self.audit.process(file_bytes)
        except Exception as exc:
            self._log.error(f"Cash Ledger processing failed: {exc}")
            raise

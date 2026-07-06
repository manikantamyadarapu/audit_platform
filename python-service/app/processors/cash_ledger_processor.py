"""Cash Ledger Audit processor."""

from typing import Any

from app.audits.cash_ledger.audit import CashLedgerAudit
from app.processors.base import BaseProcessor


class CashLedgerProcessor(BaseProcessor):
    """Validate cash ledger for negative balances, large payments, and large receipts."""

    def __init__(self) -> None:
        self.audit = CashLedgerAudit()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        """Process cash ledger Excel file and run audit rules."""
        return self.audit.process(file_bytes)

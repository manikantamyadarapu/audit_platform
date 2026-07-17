"""Negative Bank Audit processor."""

from typing import Any

from app.audits.negative_bank.audit import NegativeBankAudit
from app.processors.base import BaseProcessor
from app.utils.logger import get_logger


class NegativeBankProcessor(BaseProcessor):
    """Validate opening/closing balance rows for Credit (Cr) balances."""

    def __init__(self) -> None:
        self._log = get_logger()
        try:
            self.audit = NegativeBankAudit()
        except Exception as exc:
            self._log.error(f'Failed to initialize NegativeBankAudit: {exc}')
            raise

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        try:
            return self.audit.process(file_bytes)
        except Exception as exc:
            self._log.error(f'Negative Bank processing failed: {exc}')
            raise

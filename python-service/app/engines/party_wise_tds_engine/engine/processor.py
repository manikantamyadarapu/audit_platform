"""Party Wise TDS Summary processor."""

from typing import Any

from app.core.base_processor import BaseProcessor
from app.engines.party_wise_tds_engine.engine.audit import PartyWiseTdsAudit
from app.utils.logger import get_logger


class PartyWiseTdsProcessor(BaseProcessor):
    """Build party-wise TDS credit summaries from two ledger uploads."""

    def __init__(self) -> None:
        self._log = get_logger()
        try:
            self.audit = PartyWiseTdsAudit()
        except Exception as exc:
            self._log.error(f'Failed to initialize PartyWiseTdsAudit: {exc}')
            raise

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        raise ValueError(
            'Party Wise TDS Summary requires both purchase goods and TDS payable files'
        )

    def process_dual(
        self,
        purchase_bytes: bytes,
        payable_bytes: bytes,
    ) -> dict[str, Any]:
        try:
            return self.audit.process(purchase_bytes, payable_bytes)
        except Exception as exc:
            self._log.error(f'Party Wise TDS Summary failed: {exc}')
            raise

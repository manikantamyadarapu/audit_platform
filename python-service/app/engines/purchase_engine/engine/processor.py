"""Purchase ledger audit processor — reuses sales engine with purchase headers."""

from typing import Any

from app.core.base_processor import BaseProcessor
from app.engines.sales_engine.engine.processor import SalesAuditProcessor


class PurchaseAuditProcessor(BaseProcessor):
    """Purchase rate & ledger audit; same engine as sales, purchase account columns."""

    def __init__(self) -> None:
        self._sales = SalesAuditProcessor()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        return self._sales.process(file_bytes)

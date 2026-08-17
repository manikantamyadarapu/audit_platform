"""Purchase return audit processor."""

from typing import Any

from app.core.base_processor import BaseProcessor
from app.engines.purchase_return_engine.engine.purchase_return_audit_engine import (
    PurchaseReturnAuditEngine,
)


class PurchaseReturnAuditProcessor(BaseProcessor):
    def __init__(self) -> None:
        self.engine = PurchaseReturnAuditEngine()

    def process(
        self,
        return_file_bytes: bytes,
        stored_purchase_averages: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if not return_file_bytes:
            raise ValueError('Purchase return audit file is empty')
        return self.engine.process(return_file_bytes, stored_purchase_averages)

"""Sales return audit — single-file validation and product-wise rate comparison vs stored sales averages."""

from typing import Any

from app.core.base_processor import BaseProcessor
from app.engines.sales_return_engine.engine.sales_return_audit_engine import SalesReturnAuditEngine


class SalesReturnAuditProcessor(BaseProcessor):
    def __init__(self) -> None:
        self.engine = SalesReturnAuditEngine()

    def process(
        self,
        return_file_bytes: bytes,
        stored_sales_averages: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        if not return_file_bytes:
            raise ValueError('Sales return audit file is empty')
        return self.engine.process(return_file_bytes, stored_sales_averages)

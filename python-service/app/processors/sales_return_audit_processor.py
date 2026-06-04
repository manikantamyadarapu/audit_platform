"""Sales return audit — dual-file validation and product-wise rate comparison."""

from typing import Any

from app.processors.base import BaseProcessor
from app.sales_return_engine.engine.sales_return_audit_engine import SalesReturnAuditEngine


class SalesReturnAuditProcessor(BaseProcessor):
    def __init__(self) -> None:
        self.engine = SalesReturnAuditEngine()

    def process(self, sales_file_bytes: bytes, return_file_bytes: bytes) -> dict[str, Any]:
        if not sales_file_bytes:
            raise ValueError('Sales audit file is empty')
        if not return_file_bytes:
            raise ValueError('Sales return audit file is empty')
        return self.engine.process(sales_file_bytes, return_file_bytes)

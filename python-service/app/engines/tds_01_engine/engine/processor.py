"""TDS @ 0.1% processor."""

from typing import Any

from app.core.base_processor import BaseProcessor
from app.engines.tds_01_engine.engine.audit import Tds01Audit
from app.utils.logger import get_logger


class Tds01Processor(BaseProcessor):
    """Process Purchase Voucher Listing and compute TDS @ 0.1%."""

    def __init__(self) -> None:
        self._log = get_logger()
        try:
            self.audit = Tds01Audit()
        except Exception as exc:
            self._log.error(f'Failed to initialize Tds01Audit: {exc}')
            raise

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        try:
            return self.audit.process(file_bytes)
        except Exception as exc:
            self._log.error(f'TDS @ 0.1% processing failed: {exc}')
            raise

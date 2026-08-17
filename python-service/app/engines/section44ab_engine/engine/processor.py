"""Section 44AB Audit processor."""

from typing import Any

from app.engines.section44ab_engine.engine.audit import Section44ABAudit
from app.core.base_processor import BaseProcessor
from app.utils.logger import get_logger


class Section44ABProcessor(BaseProcessor):
    """Process Cash & Bank files for Section 44AB report."""

    def __init__(self) -> None:
        self._log = get_logger()
        try:
            self.audit = Section44ABAudit()
        except Exception as exc:
            self._log.error(f'Failed to initialize Section44ABAudit: {exc}')
            raise

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        """
        Process Section 44AB files.
        
        Note: This method accepts a single file for compatibility with BaseProcessor,
        but Section 44AB actually requires multiple files. The actual multi-file
        processing is handled via the router which calls the audit directly.
        """
        raise NotImplementedError(
            'Section 44AB requires multiple files. Use Section44ABAudit.process() directly.'
        )

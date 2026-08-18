"""Main audit module for Section 44AB Cash & Bank Audit."""

from typing import Any

from app.engines.section44ab_engine.config.constants import DEFAULT_CASH_ACCOUNT
from app.engines.section44ab_engine.engine.output import build_section44ab_response
from app.engines.section44ab_engine.parsers.workbook_loader import (
    FileProcessingResult,
    load_section44ab_files,
)
from app.utils.logger import get_logger


class Section44ABAudit:
    """Section 44AB Cash & Bank Audit processor."""

    def __init__(self) -> None:
        self._log = get_logger()

    def process(
        self,
        cash_files: list[tuple[str, bytes]],
        bank_files: list[tuple[str, bytes]],
    ) -> dict[str, Any]:
        """
        Process Cash and Bank files for Section 44AB report.
        
        Args:
            cash_files: List of (file_name, file_bytes) tuples for Cash files
            bank_files: List of (file_name, file_bytes) tuples for Bank files
        
        Returns:
            Dictionary with Section 44AB report results
        """
        try:
            loaded = load_section44ab_files(cash_files, bank_files, log=self._log)
        except Exception as exc:
            self._log.error(f'Section 44AB file loading failed: {exc}')
            raise ValueError('Failed to load Section 44AB files') from exc

        # Build the Section 44AB report
        response = build_section44ab_response(
            cash_results=loaded.cash_results,
            bank_results=loaded.bank_results,
            load_ms=loaded.load_ms,
        )

        self._log.info(
            f'Section 44AB Audit completed: '
            f'{len(loaded.cash_results)} Cash files, {len(loaded.bank_results)} Bank files, '
            f'{len(response.get("reportRows", []))} report rows'
        )

        return response

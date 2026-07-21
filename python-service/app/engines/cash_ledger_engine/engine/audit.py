"""Main audit module for Cash Ledger Audit."""

from typing import Any

from app.engines.cash_ledger_engine.config.constants import REQUIRED_COLUMNS
from app.engines.cash_ledger_engine.engine.output import build_cash_ledger_response
from app.engines.cash_ledger_engine.engine.validator import (
    validate_dataframe,
    validate_required_columns,
)
from app.engines.cash_ledger_engine.parsers.workbook_loader import load_cash_ledger_workbook
from app.core.vectorized_validation_engine import VectorizedValidationEngine
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError


class CashLedgerAudit:
    """Cash Ledger Audit processor."""
    
    def __init__(self) -> None:
        self.engine = VectorizedValidationEngine('cash_ledger')
        self._log = get_logger()
    
    def process(self, file_bytes: bytes) -> dict[str, Any]:
        """
        Process Cash Ledger Excel file and run audit rules.
        
        Args:
            file_bytes: Excel file as bytes
        
        Returns:
            Dictionary with audit results
        """
        try:
            loaded = self._load_cash_ledger_workbook(file_bytes)
        except SheetValidationError:
            raise
        except Exception as exc:
            raise ValueError('Invalid or unreadable Excel file') from exc
        
        df = loaded.dataframe
        data_columns = self.engine.user_columns(df)
        
        # Validate required columns
        is_valid, missing = validate_required_columns(set(data_columns))
        if not is_valid:
            found = sorted(c for c in data_columns if str(c).strip())
            header_excel = int(loaded.header_row_index) + 1
            raise SheetValidationError(
                f"Missing required columns after header detection: {', '.join(missing)}",
                code='MISSING_REQUIRED_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=found,
                headerRowExcel=header_excel,
                expectedColumns=sorted(REQUIRED_COLUMNS),
                hints=[
                    'Cash Ledger audit requires date, voucher_no, branch, contra_account, '
                    'debit, credit, and balance columns after header normalization.',
                    'The uploaded sheet must provide these columns. Example: "Date" → date, '
                    '"Voucher No" → voucher_no, "Balance" → balance.',
                    'Preamble/title rows above the real header are supported, but the actual header '
                    'row must contain all required fields.',
                ],
            )
        
        total_rows = len(df)
        
        # Convert to list of dictionaries for validation
        dataframe_data = df.to_dicts()
        
        # Validate dataframe
        records, summary = validate_dataframe(dataframe_data, data_columns)
        
        # Build response
        response = build_cash_ledger_response(
            total_rows=total_rows,
            error_rows=summary['failedRows'],
            summary=summary,
            records=records,
        )
        
        self._log.info(
            f"Cash Ledger Audit completed: {total_rows} total rows, "
            f"{summary['passedRows']} passed, {summary['failedRows']} failed, "
            f"{summary['totalIssues']} issues"
        )
        
        return response
    
    def _load_cash_ledger_workbook(self, file_bytes: bytes) -> Any:
        """Load workbook with automatic header detection (supports Tally/ERP title rows)."""
        return load_cash_ledger_workbook(file_bytes, log=self._log)

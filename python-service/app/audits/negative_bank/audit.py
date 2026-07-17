"""Main audit module for Negative Bank Audit."""

from typing import Any

from app.audits.cash_ledger.constants import REQUIRED_COLUMNS
from app.audits.cash_ledger.workbook_loader import load_cash_ledger_workbook
from app.audits.negative_bank.output import build_negative_bank_response
from app.audits.negative_bank.validator import (
    validate_dataframe,
    validate_required_columns,
)
from app.engines.vectorized_validation_engine import VectorizedValidationEngine
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError


class NegativeBankAudit:
    """Negative Bank Audit processor — reuses Cash Ledger workbook loader/parser."""

    def __init__(self) -> None:
        self.engine = VectorizedValidationEngine('negative_bank')
        self._log = get_logger()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        """Process Excel file and run Negative Bank rule only."""
        try:
            loaded = load_cash_ledger_workbook(file_bytes, log=self._log)
        except SheetValidationError:
            raise
        except Exception as exc:
            raise ValueError('Invalid or unreadable Excel file') from exc

        df = loaded.dataframe
        data_columns = self.engine.user_columns(df)

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
                    'Negative Bank audit requires the same Cash Book columns: date, voucher_no, '
                    'branch, contra_account, debit, credit, and balance after header normalization.',
                    'Example: "Date" → date, "Voucher No" → voucher_no, "Balance" → balance.',
                    'Preamble/title rows above the real header are supported.',
                ],
            )

        total_rows = len(df)
        dataframe_data = df.to_dicts()
        records, summary = validate_dataframe(dataframe_data, data_columns)

        response = build_negative_bank_response(
            total_rows=total_rows,
            error_rows=summary['failedRows'],
            summary=summary,
            records=records,
        )

        self._log.info(
            f"Negative Bank Audit completed: {total_rows} total rows, "
            f"{summary['passedRows']} passed, {summary['failedRows']} failed, "
            f"{summary['totalIssues']} issues"
        )

        return response

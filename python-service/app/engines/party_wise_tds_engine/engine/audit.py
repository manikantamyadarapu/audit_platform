"""Party Wise TDS Summary audit — consolidates credit by Contra Account per file."""

from __future__ import annotations

from typing import Any

from app.core.vectorized_validation_engine import VectorizedValidationEngine
from app.engines.cash_ledger_engine.config.constants import REQUIRED_COLUMNS
from app.engines.cash_ledger_engine.engine.validator import validate_required_columns
from app.engines.cash_ledger_engine.parsers.workbook_loader import load_cash_ledger_workbook
from app.engines.party_wise_tds_engine.engine.output import build_party_wise_tds_response
from app.engines.party_wise_tds_engine.engine.summary import (
    summarize_purchase_goods,
    summarize_tds_payable,
)
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError


class PartyWiseTdsAudit:
    """Informational summary only — no validation / reconciliation."""

    def __init__(self) -> None:
        self.engine = VectorizedValidationEngine('party_wise_tds')
        self._log = get_logger()

    def process(self, purchase_bytes: bytes, payable_bytes: bytes) -> dict[str, Any]:
        purchase_rows, purchase_count = self._load_transaction_rows(
            purchase_bytes,
            label='TDS on Purchase of Goods',
        )
        payable_rows, payable_count = self._load_transaction_rows(
            payable_bytes,
            label='TDS Payable Account',
        )

        purchase_summary = summarize_purchase_goods(purchase_rows)
        payable_summary = summarize_tds_payable(payable_rows)

        response = build_party_wise_tds_response(
            purchase_summary=purchase_summary,
            payable_summary=payable_summary,
            purchase_row_count=purchase_count,
            payable_row_count=payable_count,
        )

        self._log.info(
            'Party Wise TDS Summary completed: purchase_parties=%s payable_parties=%s',
            len(purchase_summary),
            len(payable_summary),
        )
        return response

    def _load_transaction_rows(
        self,
        file_bytes: bytes,
        *,
        label: str,
    ) -> tuple[list[dict[str, Any]], int]:
        try:
            loaded = load_cash_ledger_workbook(file_bytes, log=self._log)
        except SheetValidationError:
            raise
        except Exception as exc:
            raise ValueError(f'Invalid or unreadable Excel file ({label})') from exc

        df = loaded.dataframe
        data_columns = self.engine.user_columns(df)
        is_valid, missing = validate_required_columns(set(data_columns))
        if not is_valid:
            found = sorted(c for c in data_columns if str(c).strip())
            header_excel = int(loaded.header_row_index) + 1
            raise SheetValidationError(
                f'{label}: missing required columns after header detection: '
                f"{', '.join(missing)}",
                code='MISSING_REQUIRED_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=found,
                headerRowExcel=header_excel,
                expectedColumns=sorted(REQUIRED_COLUMNS),
                hints=[
                    f'{label} uses the same Cash Book columns: date, voucher_no, branch, '
                    'contra_account, debit, credit, and balance after header normalization.',
                    'Example: "Contra Account" → contra_account, "Credit" → credit.',
                ],
            )

        rows = df.to_dicts()
        return rows, len(rows)

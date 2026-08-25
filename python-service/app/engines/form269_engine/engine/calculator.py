"""Form 269SS (Credit) and 269ST (Debit) row builders."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.engines.form269_engine.config.constants import (
    ACCOUNT_BANK,
    ACCOUNT_CASH,
    CASH_ACCOUNT_LABEL,
    COL_ACCOUNT_PAYEE,
    COL_AMOUNT,
    COL_LENDER_AADHAAR,
    COL_LENDER_ADDRESS,
    COL_LENDER_NAME,
    COL_LENDER_PAN,
    COL_MAXIMUM_OUTSTANDING,
    COL_NATURE_CODE,
    COL_PLEASE_SPECIFY,
    COL_SQUARED_UP,
    COL_TAKEN_BY_CHEQUE_ECS,
    OPENING_BALANCE_PATTERNS,
)
from app.engines.form269_engine.parsers.master_loader import lookup_master_record
from app.engines.section44ab_engine.parsers.workbook_loader import _parse_numeric_value
from app.utils.header_cleaner import normalize_header


def _is_opening_balance_row(contra_account: Any) -> bool:
    if not contra_account:
        return False
    return normalize_header(contra_account) in OPENING_BALANCE_PATTERNS


def is_cash_account(contra_account: Any) -> bool:
    return normalize_header(contra_account) == CASH_ACCOUNT_LABEL


@dataclass
class AmountAccumulator:
    credit_sum: float = 0.0
    debit_sum: float = 0.0
    max_credit: float = 0.0
    max_debit: float = 0.0
    last_balance: float | None = None
    row_count: int = 0


@dataclass
class FileTotals:
    cash: AmountAccumulator = field(default_factory=AmountAccumulator)
    bank: AmountAccumulator = field(default_factory=AmountAccumulator)


def _update(acc: AmountAccumulator, row: dict[str, Any]) -> None:
    credit = _parse_numeric_value(row.get('credit'))
    debit = _parse_numeric_value(row.get('debit'))
    balance = _parse_numeric_value(row.get('balance'))
    acc.credit_sum += credit
    acc.debit_sum += debit
    acc.max_credit = max(acc.max_credit, credit)
    acc.max_debit = max(acc.max_debit, debit)
    acc.last_balance = balance
    acc.row_count += 1


def aggregate_file_rows(rows: list[dict[str, Any]]) -> FileTotals:
    """
    Total a ledger excluding Balance b/f.

    Cash Account contra rows feed the Cash Account identity row; all other
    non-opening rows feed the Bank Account identity row. This is only used
    to choose the account suffix on the lender name, not as a report grouping column.
    """
    totals = FileTotals()
    for row in rows:
        if _is_opening_balance_row(row.get('contra_account')):
            continue
        target = totals.cash if is_cash_account(row.get('contra_account')) else totals.bank
        _update(target, row)
    return totals


def squared_up_status(last_balance: float | None) -> str:
    """Last applicable Balance != 0 → Yes; otherwise No."""
    if last_balance is None:
        return 'No'
    return 'Yes' if last_balance != 0 else 'No'


def format_lender_display_name(master: dict[str, str], account_label: str) -> str:
    """`<Name> (Bank Account|Cash Account)` from master/filename plus account suffix."""
    name = (master.get('name') or '').strip()
    return f'{name} ({account_label})'


def _build_row(
    *,
    master: dict[str, str],
    account_label: str,
    squared: str,
    use_credit: bool,
    acc: AmountAccumulator,
) -> dict[str, Any]:
    if use_credit:
        amount = round(acc.credit_sum, 2)
        maximum_outstanding = round(acc.max_credit, 2)
    else:
        amount = round(acc.debit_sum, 2)
        maximum_outstanding = round(acc.max_debit, 2)

    return {
        COL_LENDER_NAME: format_lender_display_name(master, account_label),
        COL_LENDER_ADDRESS: (master.get('address') or '').strip(),
        COL_LENDER_PAN: (master.get('pan') or '').strip(),
        COL_LENDER_AADHAAR: (master.get('aadhaar') or '').strip(),
        COL_AMOUNT: amount,
        COL_SQUARED_UP: squared,
        COL_MAXIMUM_OUTSTANDING: maximum_outstanding,
        COL_TAKEN_BY_CHEQUE_ECS: '',
        COL_NATURE_CODE: '',
        COL_PLEASE_SPECIFY: '',
        COL_ACCOUNT_PAYEE: '',
    }


def build_form_records(
    *,
    lender_name: str,
    totals: FileTotals,
    master_records: dict[str, dict[str, str]],
    use_credit: bool,
) -> list[dict[str, Any]]:
    """Build 269SS or 269ST rows for one ledger file."""
    master = lookup_master_record(lender_name, master_records)
    records: list[dict[str, Any]] = []

    if totals.cash.row_count:
        records.append(
            _build_row(
                master=master,
                account_label=ACCOUNT_CASH,
                squared=squared_up_status(totals.cash.last_balance),
                use_credit=use_credit,
                acc=totals.cash,
            )
        )
    if totals.bank.row_count:
        records.append(
            _build_row(
                master=master,
                account_label=ACCOUNT_BANK,
                squared=squared_up_status(totals.bank.last_balance),
                use_credit=use_credit,
                acc=totals.bank,
            )
        )
    return records

"""Business rule for Negative Bank Audit."""

from typing import Any

from app.audits.cash_ledger.parser import parse_balance
from app.audits.negative_bank.constants import ISSUE_NEGATIVE_BANK
from app.audits.negative_bank.utils import is_negative_bank_contra_account


def check_negative_bank(row: dict[str, Any]) -> bool:
    """
    Negative Bank rule.

    Step 1 — Contra Account must be an opening/closing style marker.
    Step 2 — Balance must contain Cr (Dr always passes).

    Returns True if issue detected.
    """
    if not is_negative_bank_contra_account(row.get('contra_account')):
        return False

    balance_value = row.get('balance')
    if balance_value is None:
        return False

    balance_str = str(balance_value).strip().upper()
    if 'CR' in balance_str:
        return True

    _numeric_value, balance_type = parse_balance(balance_str)
    return balance_type == 'CR'


def apply_all_rules(row: dict[str, Any]) -> list[str]:
    """Apply Negative Bank rules and return issue codes."""
    issues: list[str] = []
    if check_negative_bank(row):
        issues.append(ISSUE_NEGATIVE_BANK)
    return issues

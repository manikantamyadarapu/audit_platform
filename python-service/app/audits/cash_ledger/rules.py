"""Business rules for Cash Ledger Audit."""

from typing import Any

from app.audits.cash_ledger.constants import (
    CASH_PAYMENT_EXCEPTIONS,
    CASH_PAYMENT_THRESHOLD,
    CASH_RECEIPT_EXCEPTIONS,
    CASH_RECEIPT_THRESHOLD,
    ISSUE_CASH_PAYMENT_GT_10000,
    ISSUE_CASH_RECEIPT_GT_200000,
    ISSUE_NEGATIVE_CASH_BALANCE,
)


def check_negative_cash_balance(row: dict[str, Any]) -> bool:
    """
    RULE 1: Negative Cash Balance

    Business Rule: The Balance column should NEVER become negative.
    Balance should always represent Debit (Dr).

    Validation:
    - Remove commas
    - Extract numeric value
    - Detect Dr / Cr
    - If balance contains "Cr" OR numeric value is less than zero -> INVALID

    Returns True if issue detected.
    """
    balance_value = row.get('balance')

    if balance_value is None:
        return False

    balance_str = str(balance_value).strip().upper()

    # Check if balance contains 'Cr'
    if 'CR' in balance_str:
        return True

    # Parse numeric value
    from app.audits.cash_ledger.parser import parse_balance
    numeric_value, balance_type = parse_balance(balance_str)

    if numeric_value is None:
        return False

    # Check if numeric value is negative
    if numeric_value < 0:
        return True

    # Check if balance_type is CR
    if balance_type == 'CR':
        return True

    return False


def check_cash_payment_above_threshold(row: dict[str, Any]) -> bool:
    """
    RULE 2: Cash Payments above Rs.10,000

    Business Rule: Credit represents Cash Payments.
    Any Credit transaction >= 10000 should be reported.

    Exceptions: Ignore if Contra Account contains:
    - Closing Balance
    - Balance c/f

    Returns True if issue detected.
    """
    credit_value = row.get('credit')
    contra_account = row.get('contra_account', '')

    if not credit_value:
        return False

    # Check exceptions
    contra_account_normalized = str(contra_account).strip().lower()
    for exception in CASH_PAYMENT_EXCEPTIONS:
        if exception in contra_account_normalized:
            return False

    # Parse credit amount
    from app.audits.cash_ledger.parser import parse_amount
    credit_amount = parse_amount(credit_value)

    if credit_amount is None:
        return False

    return credit_amount >= CASH_PAYMENT_THRESHOLD


def check_cash_receipt_above_threshold(row: dict[str, Any]) -> bool:
    """
    RULE 3: Cash Receipts above Rs.2,00,000

    Business Rule: Debit represents Cash Receipts.
    Any Debit transaction >= 200000 should be reported.

    Exceptions: Ignore if Contra Account contains:
    - Opening Balance
    - Balance b/f

    Returns True if issue detected.
    """
    debit_value = row.get('debit')
    contra_account = row.get('contra_account', '')

    if not debit_value:
        return False

    # Check exceptions
    contra_account_normalized = str(contra_account).strip().lower()
    for exception in CASH_RECEIPT_EXCEPTIONS:
        if exception in contra_account_normalized:
            return False

    # Parse debit amount
    from app.audits.cash_ledger.parser import parse_amount
    debit_amount = parse_amount(debit_value)

    if debit_amount is None:
        return False

    return debit_amount >= CASH_RECEIPT_THRESHOLD


def apply_all_rules(row: dict[str, Any]) -> list[str]:
    """
    Apply all business rules to a row and return list of issue codes.

    Returns:
        List of issue codes detected for this row.
    """
    issues: list[str] = []

    if check_negative_cash_balance(row):
        issues.append(ISSUE_NEGATIVE_CASH_BALANCE)

    if check_cash_payment_above_threshold(row):
        issues.append(ISSUE_CASH_PAYMENT_GT_10000)

    if check_cash_receipt_above_threshold(row):
        issues.append(ISSUE_CASH_RECEIPT_GT_200000)

    return issues

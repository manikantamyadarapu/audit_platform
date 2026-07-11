"""Parser utilities for Cash Ledger Audit."""

import re
from typing import Any, Tuple


def is_empty_field(value: Any) -> bool:
    """Return True when a ledger cell has no meaningful content."""
    if value is None:
        return True
    if isinstance(value, float) and value != value:  # NaN
        return True
    return not str(value).strip()


def is_auditable_transaction_row(row: dict[str, Any]) -> bool:
    """
    Return True when a row represents a real ledger transaction.

    Grand total / summary rows (and other non-transaction rows) lack date,
    voucher number, and contra account. They must be excluded before audit rules run.
    """
    return any(
        not is_empty_field(row.get(field))
        for field in ('date', 'voucher_no', 'contra_account')
    )


def is_report_total_row(row: dict[str, Any]) -> bool:
    """
    Detect report grand-total rows.

    These rows only carry debit/credit totals while date, voucher, branch,
    contra account, and balance are all empty.
    """
    summary_fields_empty = all(
        is_empty_field(row.get(field))
        for field in ('date', 'voucher_no', 'branch', 'contra_account', 'balance')
    )
    if not summary_fields_empty:
        return False
    return (
        parse_amount(row.get('debit')) is not None
        or parse_amount(row.get('credit')) is not None
    )


def parse_amount(amount_str: str | None) -> float | None:
    """
    Convert formatted amount string to numeric value.
    
    Examples:
        '11,23,145.00' -> 1123145.00
        '95,000' -> 95000.0
        '500' -> 500.0
        None -> None
        '' -> None
    """
    if not amount_str or str(amount_str).strip() == '':
        return None
    
    # Remove commas and whitespace
    cleaned = str(amount_str).replace(',', '').strip()
    
    # Remove any non-numeric characters except decimal point and negative sign
    cleaned = re.sub(r'[^\d.\-]', '', cleaned)
    
    if not cleaned or cleaned == '.' or cleaned == '-':
        return None
    
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def parse_balance(balance_str: str | None) -> Tuple[float | None, str | None]:
    """
    Extract numeric value and Dr/Cr type from balance string.
    
    Examples:
        '1,12,33,145 Dr' -> (11233145.0, 'DR')
        '95,000 Cr' -> (95000.0, 'CR')
        '500' -> (500.0, None)
        '-2500' -> (-2500.0, None)
        None -> (None, None)
    """
    if not balance_str or str(balance_str).strip() == '':
        return None, None
    
    balance_str = str(balance_str).strip().upper()
    
    # Detect Dr/Cr
    balance_type = None
    if 'DR' in balance_str:
        balance_type = 'DR'
        balance_str = balance_str.replace('DR', '').strip()
    elif 'CR' in balance_str:
        balance_type = 'CR'
        balance_str = balance_str.replace('CR', '').strip()
    
    # Parse numeric value
    numeric_value = parse_amount(balance_str)
    
    return numeric_value, balance_type

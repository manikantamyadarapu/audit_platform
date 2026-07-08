"""Output formatting for Cash Ledger Audit."""

from typing import Any

from app.utils.response_builder import build_processing_response


def build_cash_ledger_response(
    total_rows: int,
    error_rows: int,
    summary: dict[str, Any],
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Build standardized response for Cash Ledger Audit.
    
    Args:
        total_rows: Total number of rows processed
        error_rows: Number of rows with issues
        summary: Summary dictionary with issue counts
        records: List of failed row records
    
    Returns:
        Standardized response dictionary
    """
    response = build_processing_response(
        file_type='cash_ledger',
        total_rows=total_rows,
        error_rows=error_rows,
        summary=summary,
        records=records,
    )
    
    # Add export columns for Excel download
    response['exportColumns'] = [
        'rowNumber',
        'date',
        'voucher_no',
        'branch',
        'contra_account',
        'debit',
        'credit',
        'balance',
        'Message',
    ]

    response['columnDisplayHeaders'] = {
        'rowNumber': 'Row No',
        'date': 'Date',
        'voucher_no': 'Voucher No',
        'branch': 'Branch',
        'contra_account': 'Contra Account',
        'debit': 'Debit',
        'credit': 'Credit',
        'balance': 'Balance',
        'Message': 'Message',
    }

    return response

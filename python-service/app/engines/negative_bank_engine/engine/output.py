"""Output formatting for Negative Bank Audit."""

from typing import Any

from app.utils.response_builder import build_processing_response


def build_negative_bank_response(
    total_rows: int,
    error_rows: int,
    summary: dict[str, Any],
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build standardized response for Negative Bank Audit."""
    response = build_processing_response(
        file_type='negative_bank',
        total_rows=total_rows,
        error_rows=error_rows,
        summary=summary,
        records=records,
    )

    response['exportColumns'] = [
        'rowNumber',
        'date',
        'voucher_no',
        'branch',
        'contra_account',
        'debit',
        'credit',
        'balance',
        'tillDate',
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
        'tillDate': 'Till Date',
        'Message': 'Message',
    }

    return response

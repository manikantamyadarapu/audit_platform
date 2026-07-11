"""Tests for Cash Ledger parser row classification."""

from app.audits.cash_ledger.parser import (
    is_auditable_transaction_row,
    is_report_total_row,
)


def test_is_report_total_row_detects_grand_total() -> None:
    row = {
        'date': None,
        'voucher_no': '',
        'branch': '',
        'contra_account': None,
        'balance': '',
        'debit': '56,25,62,210.00',
        'credit': '55,18,59,678.00',
    }
    assert is_report_total_row(row) is True
    assert is_auditable_transaction_row(row) is False


def test_is_auditable_transaction_row_accepts_real_transaction() -> None:
    row = {
        'date': '01-04-2025',
        'voucher_no': 'V001',
        'branch': 'HQ',
        'contra_account': 'Sales',
        'balance': '2,50,000 Dr',
        'debit': 250000,
        'credit': None,
    }
    assert is_auditable_transaction_row(row) is True
    assert is_report_total_row(row) is False


def test_is_auditable_transaction_row_accepts_contra_only_identifier() -> None:
    row = {
        'date': '',
        'voucher_no': '',
        'contra_account': 'Opening Balance',
        'balance': '1,00,000 Dr',
        'debit': None,
        'credit': None,
    }
    assert is_auditable_transaction_row(row) is True

"""Tests for bank-account detection and Cash Payments exclusion."""

from app.engines.cash_ledger_engine.config.constants import ISSUE_CASH_PAYMENT_GT_10000
from app.engines.cash_ledger_engine.engine.rules import (
    apply_all_rules,
    check_cash_payment_above_threshold,
    check_cash_receipt_above_threshold,
    check_negative_cash_balance,
)
from app.engines.cash_ledger_engine.engine.utils import is_bank_account


def test_is_bank_account_detects_example_banks():
    assert is_bank_account('UCO Bank Limited') is True
    assert is_bank_account('State Bank of India') is True
    assert is_bank_account('Indian Overseas Bank Limited') is True
    assert is_bank_account('Kotak Mahindra Bank Cash Credit Account') is True
    assert is_bank_account('HDFC Bank') is True
    assert is_bank_account('ICICI Bank') is True
    assert is_bank_account('Axis Bank') is True
    assert is_bank_account('Canara Bank') is True
    assert is_bank_account('Union Bank') is True
    assert is_bank_account('Punjab National Bank') is True
    assert is_bank_account('Bank of Baroda') is True
    assert is_bank_account('SBI') is True


def test_is_bank_account_case_insensitive():
    assert is_bank_account('uco BANK limited') is True
    assert is_bank_account('  hdfc bank  ') is True


def test_is_bank_account_rejects_non_bank_parties():
    assert is_bank_account('Petrol Expenses') is False
    assert is_bank_account('Mr. Ramesh') is False
    assert is_bank_account('Vendor ABC') is False
    assert is_bank_account('') is False
    assert is_bank_account(None) is False


def test_cash_payment_ignores_bank_deposits():
    for contra in (
        'UCO Bank Limited',
        'State Bank of India',
        'Indian Overseas Bank Limited',
        'Kotak Mahindra Bank Cash Credit Account',
    ):
        row = {'contra_account': contra, 'credit': 780000, 'debit': None, 'balance': '1,00,000 Dr'}
        assert check_cash_payment_above_threshold(row) is False
        assert ISSUE_CASH_PAYMENT_GT_10000 not in apply_all_rules(row)


def test_cash_payment_flags_actual_party_payments():
    for contra, credit in (
        ('Petrol Expenses', 15000),
        ('Mr. Ramesh', 25000),
    ):
        row = {'contra_account': contra, 'credit': credit, 'debit': None, 'balance': '1,00,000 Dr'}
        assert check_cash_payment_above_threshold(row) is True
        assert ISSUE_CASH_PAYMENT_GT_10000 in apply_all_rules(row)


def test_other_cash_ledger_rules_unchanged_for_bank_rows():
    """Bank exclusion applies only to Cash Payments — other rules still evaluate."""
    # Negative cash still flags on Cr balance even if contra is a bank
    negative_row = {
        'contra_account': 'HDFC Bank',
        'credit': 5000,
        'debit': None,
        'balance': '10,000 Cr',
    }
    assert check_negative_cash_balance(negative_row) is True
    assert check_cash_payment_above_threshold(negative_row) is False

    # Cash receipts rule still uses debit + its own exceptions (bank not excluded here)
    receipt_row = {
        'contra_account': 'Mr. Ramesh',
        'credit': None,
        'debit': 250000,
        'balance': '1,00,000 Dr',
    }
    assert check_cash_receipt_above_threshold(receipt_row) is True

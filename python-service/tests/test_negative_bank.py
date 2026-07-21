"""Tests for Negative Bank audit module."""

from datetime import date

from app.engines.negative_bank_engine.config.constants import ISSUE_NEGATIVE_BANK, MESSAGE_NEGATIVE_BANK
from app.engines.negative_bank_engine.engine.rules import apply_all_rules, check_negative_bank
from app.engines.negative_bank_engine.engine.utils import is_negative_bank_contra_account
from app.engines.negative_bank_engine.engine.validator import validate_row
from app.engines.cash_ledger_engine.engine.rules import apply_all_rules as apply_cash_ledger_rules
from app.utils.date_utils import days_since_transaction, format_till_date


def test_negative_bank_contra_markers() -> None:
    assert is_negative_bank_contra_account('Opening Balance') is True
    assert is_negative_bank_contra_account('CLOSING BALANCE') is True
    assert is_negative_bank_contra_account('Balance b/f') is True
    assert is_negative_bank_contra_account('Balance c/f') is True
    assert is_negative_bank_contra_account('OB') is True
    assert is_negative_bank_contra_account('CB') is True
    assert is_negative_bank_contra_account('Opening') is True
    assert is_negative_bank_contra_account('Closing') is True
    assert is_negative_bank_contra_account('Party Cash') is False


def test_negative_bank_only_fails_on_credit_balance() -> None:
    assert (
        check_negative_bank(
            {'contra_account': 'Opening Balance', 'balance': '10,00,000 Cr'}
        )
        is True
    )
    assert (
        check_negative_bank(
            {'contra_account': 'Opening Balance', 'balance': '10,00,000 Dr'}
        )
        is False
    )
    assert (
        check_negative_bank(
            {'contra_account': 'Party A', 'balance': '10,00,000 Cr'}
        )
        is False
    )


def test_apply_all_rules_appends_negative_bank() -> None:
    issues = apply_all_rules(
        {
            'contra_account': 'Closing Balance',
            'balance': '1,25,000 Cr',
            'debit': None,
            'credit': None,
        }
    )
    assert issues == [ISSUE_NEGATIVE_BANK]


def test_cash_ledger_does_not_emit_negative_bank() -> None:
    issues = apply_cash_ledger_rules(
        {
            'contra_account': 'Opening Balance',
            'balance': '10,00,000 Cr',
            'debit': None,
            'credit': None,
        }
    )
    assert ISSUE_NEGATIVE_BANK not in issues
    assert 'NEGATIVE_CASH_BALANCE' in issues


def test_till_date_uses_shared_date_utils() -> None:
    days = days_since_transaction('01-04-2025', today=date(2026, 7, 14))
    assert days == 469
    assert format_till_date(days) == '469 Days'


def test_validate_row_adds_till_date_for_negative_bank() -> None:
    record = validate_row(
        {
            'date': '01-04-2025',
            'voucher_no': '',
            'branch': '',
            'contra_account': 'Opening Balance',
            'debit': None,
            'credit': None,
            'balance': '10,00,000 Cr',
        },
        row_number=10,
        data_columns=[
            'date',
            'voucher_no',
            'branch',
            'contra_account',
            'debit',
            'credit',
            'balance',
        ],
    )
    assert ISSUE_NEGATIVE_BANK in record['issues']
    assert MESSAGE_NEGATIVE_BANK in record['Message']
    assert 'Days' in record['tillDate']

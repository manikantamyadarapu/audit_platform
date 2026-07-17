"""Constants for Negative Bank Audit."""

from typing import Final

from app.audits.cash_ledger.constants import REQUIRED_COLUMNS as CASH_LEDGER_REQUIRED_COLUMNS

ISSUE_NEGATIVE_BANK: Final = 'NEGATIVE_BANK'
MESSAGE_NEGATIVE_BANK: Final = 'Negative Bank'

SEVERITY_HIGH: Final = 'High'

ISSUE_MESSAGES: Final = {
    ISSUE_NEGATIVE_BANK: MESSAGE_NEGATIVE_BANK,
}

ISSUE_SEVERITY: Final = {
    ISSUE_NEGATIVE_BANK: SEVERITY_HIGH,
}

# Same workbook schema as Cash Ledger (reuse required column set)
REQUIRED_COLUMNS: Final = CASH_LEDGER_REQUIRED_COLUMNS

NEGATIVE_BANK_CONTRA_PHRASES: Final = frozenset({
    'opening balance',
    'closing balance',
    'balance b/f',
    'balance c/f',
    'opening',
    'closing',
})

NEGATIVE_BANK_CONTRA_TOKENS: Final = frozenset({
    'ob',
    'cb',
})

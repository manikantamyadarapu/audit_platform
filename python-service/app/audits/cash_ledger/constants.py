"""Constants for Cash Ledger Audit."""

from typing import Final

# Issue codes
ISSUE_NEGATIVE_CASH_BALANCE: Final = "NEGATIVE_CASH_BALANCE"
ISSUE_CASH_PAYMENT_GT_10000: Final = "CASH_PAYMENT_GT_10000"
ISSUE_CASH_RECEIPT_GT_200000: Final = "CASH_RECEIPT_GT_200000"

# Issue messages (exact audit report wording)
MESSAGE_NEGATIVE_CASH_BALANCE: Final = "Negative Cash"
MESSAGE_CASH_PAYMENT_GT_10000: Final = "Cash Payments>=Rs. 10,000/-"
MESSAGE_CASH_RECEIPT_GT_200000: Final = "Cash Receipts>=Rs. 2,00,000/-"

# Severity levels
SEVERITY_HIGH: Final = "High"
SEVERITY_MEDIUM: Final = "Medium"

# Issue code to message mapping
ISSUE_MESSAGES: Final = {
    ISSUE_NEGATIVE_CASH_BALANCE: MESSAGE_NEGATIVE_CASH_BALANCE,
    ISSUE_CASH_PAYMENT_GT_10000: MESSAGE_CASH_PAYMENT_GT_10000,
    ISSUE_CASH_RECEIPT_GT_200000: MESSAGE_CASH_RECEIPT_GT_200000,
}

# Issue code to severity mapping
ISSUE_SEVERITY: Final = {
    ISSUE_NEGATIVE_CASH_BALANCE: SEVERITY_HIGH,
    ISSUE_CASH_PAYMENT_GT_10000: SEVERITY_MEDIUM,
    ISSUE_CASH_RECEIPT_GT_200000: SEVERITY_MEDIUM,
}

# Required columns
REQUIRED_COLUMNS: Final = frozenset({
    'date',
    'voucher_no',
    'branch',
    'contra_account',
    'debit',
    'credit',
    'balance',
})

# Optional columns (not required for validation but preserved in output)
OPTIONAL_COLUMNS: Final = frozenset({
    'sno',
    'remarks',
    'division',
})

# Exception contra accounts for cash payments
CASH_PAYMENT_EXCEPTIONS: Final = frozenset({
    'closing balance',
    'balance c/f',
})

# Exception contra accounts for cash receipts
CASH_RECEIPT_EXCEPTIONS: Final = frozenset({
    'opening balance',
    'balance b/f',
})

# Thresholds
CASH_PAYMENT_THRESHOLD: Final = 10000
CASH_RECEIPT_THRESHOLD: Final = 200000

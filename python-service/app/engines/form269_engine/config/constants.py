"""Constants for Form 269SS / 269ST combined processing."""

from typing import Final

CASH_ACCOUNT_LABEL: Final = 'cash_account'

ACCOUNT_CASH: Final = 'Cash Account'
ACCOUNT_BANK: Final = 'Bank Account'

# Required ledger header markers (matched case-insensitively via normalize_header).
FORM269_HEADER_MARKER_COLUMNS: Final = frozenset({
    'date',
    'voucher_no',
    'contra_account',
    'debit',
    'credit',
    'balance',
})

# Optional ledger columns accepted when present in the upload.
FORM269_OPTIONAL_LEDGER_COLUMNS: Final = frozenset({
    'sno',
    'branch',
    'division',
    'remarks',
    'comments',
    'cheque_no',
    'cheque_date',
})

OPENING_BALANCE_PATTERNS: Final = frozenset({
    'balance_b_f',
    'balance_bf',
    'opening_balance',
    'ob',
})

MASTER_JSON_FIELDS: Final = ('name', 'address', 'pan', 'aadhaar')

COL_LENDER_NAME: Final = 'lender_name'
COL_LENDER_ADDRESS: Final = 'lender_address'
COL_LENDER_PAN: Final = 'lender_pan'
COL_LENDER_AADHAAR: Final = 'lender_aadhaar'
COL_AMOUNT: Final = 'amount'
COL_SQUARED_UP: Final = 'squared_up'
COL_MAXIMUM_OUTSTANDING: Final = 'maximum_outstanding'
COL_TAKEN_BY_CHEQUE_ECS: Final = 'taken_by_cheque_ecs'
COL_NATURE_CODE: Final = 'nature_code'
COL_PLEASE_SPECIFY: Final = 'please_specify'
COL_ACCOUNT_PAYEE: Final = 'account_payee_cheque'

EXPORT_COLUMNS: Final = (
    COL_LENDER_NAME,
    COL_LENDER_ADDRESS,
    COL_LENDER_PAN,
    COL_LENDER_AADHAAR,
    COL_AMOUNT,
    COL_SQUARED_UP,
    COL_MAXIMUM_OUTSTANDING,
    COL_TAKEN_BY_CHEQUE_ECS,
    COL_NATURE_CODE,
    COL_PLEASE_SPECIFY,
    COL_ACCOUNT_PAYEE,
)

EXPORT_HEADER_MAP: Final = {
    COL_LENDER_NAME: 'Name of lender or depositor',
    COL_LENDER_ADDRESS: 'Address of lender or depositor',
    COL_LENDER_PAN: 'PAN of the lender or depositor(optional)',
    COL_LENDER_AADHAAR: 'Aadhaar no (optional)',
    COL_AMOUNT: 'Amount of loan or deposit taken or accepted',
    COL_SQUARED_UP: 'Whether the loan/deposit was squared up during the Previous Year',
    COL_MAXIMUM_OUTSTANDING: (
        'Maximum amount outstanding in the account at any time during the previous year'
    ),
    COL_TAKEN_BY_CHEQUE_ECS: (
        'Whether the loan or deposit was taken or accepted by cheque or bank draft '
        'or use of the electronic clearing system through a bank account'
    ),
    COL_NATURE_CODE: 'Code of the nature of such amount (as mentioned in field (iv) above)',
    COL_PLEASE_SPECIFY: 'Please specify',
    COL_ACCOUNT_PAYEE: (
        'In case of loan or deposit was taken or deposit was accepted by cheque or bank draft '
        'whether the same was taken or accepted by an account payee cheque or an account payee bank draft'
    ),
}

SHEET_269SS: Final = '269SS'
SHEET_269ST: Final = '269ST'
EMPTY_SHEET_MESSAGE: Final = 'No report rows for this form.'
HEADER_SCAN_LIMIT: Final = 20
MASTER_REFERENCE_FILENAME: Final = 'form269_master_reference.json'

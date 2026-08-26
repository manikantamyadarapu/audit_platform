"""Constants for Section 44AB Cash & Bank Audit."""

from typing import Final

# Header detection markers (must contain all these to qualify as transaction header)
SECTION44AB_HEADER_MARKER_COLUMNS: Final = frozenset({
    'date',
    'voucher_no',
    'contra_account',
    'debit',
    'credit',
    'balance',
})

# Opening balance patterns — must match normalize_header() output
# e.g. "Balance b/f" → "balance_b_f"
OPENING_BALANCE_PATTERNS: Final = frozenset({
    'balance_b_f',
    'balance_bf',
    'opening_balance',
    'ob',
})

# Required columns for validation
REQUIRED_COLUMNS: Final = frozenset({
    'date',
    'voucher_no',
    'contra_account',
    'debit',
    'credit',
    'balance',
})

# Optional columns (not required but preserved if present)
OPTIONAL_COLUMNS: Final = frozenset({
    'sno',
    'remarks',
    'division',
    'branch',
})

# Header scan limit
HEADER_SCAN_LIMIT: Final = 20

# Account name detection patterns
ACCOUNT_NAME_PATTERNS: Final = frozenset({
    'account:',
    'account name:',
    'ledger:',
    'ledger name:',
})

# Default cash account name if not detected
DEFAULT_CASH_ACCOUNT: Final = 'Cash Account'

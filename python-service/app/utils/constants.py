import re

PAN_REGEX = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'
_PAN_COMPILED = re.compile(PAN_REGEX)

# Non-PAN declarations treated as valid when a PAN is required (e.g. >₹2L), after normalizing spaces/hyphens.
PAN_ALTERNATIVE_NORMALIZED = frozenset({'usdl'})


def compact_pan_input_for_validation(value: object) -> str:
    """Collapse whitespace so spaced PAN cells (e.g. 'ALOPY 6826 F') match PAN_REGEX."""
    if value is None:
        return ''
    return ''.join(str(value).split()).upper()


def normalize_pan_alternative_key(value: object) -> str:
    """Lowercase letters/digits only: 'Form No-60' → 'formno60'; 'US DL' / 'USDL -' → 'usdl'."""
    if value is None:
        return ''
    return re.sub(r'[^a-z0-9]', '', str(value).lower())


def is_acceptable_pan_equivalent(value: object) -> bool:
    """Indian PAN format, or accepted alternatives (US DL — spacing/hyphens ignored)."""
    compact = compact_pan_input_for_validation(value)
    if compact and _PAN_COMPILED.fullmatch(compact):
        return True
    key = normalize_pan_alternative_key(value)
    return bool(key) and key in PAN_ALTERNATIVE_NORMALIZED

# Human-readable PAN / address messages (codes remain in records['issues'] for API compatibility)
PAN_MISSING_OR_INVALID_MESSAGE = 'No valid PAN found in PAN or PAN1 columns'
ADDRESS_PROOF_MISSING_MESSAGE = 'Address proof missing in both address proof columns'

GST_REGEX = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$'

SPREADSHEET_EMPTY_TOKENS = frozenset(
    {'', 'pending', 'na', 'n/a', 'none', 'null', 'nan', '-', '----'}
)

NEGATIVE_WEIGHT_MESSAGE = 'Negative weight values are not allowed'
GROSS_WEIGHT_MISMATCH_MESSAGE = 'Manual gross weight does not match auto gross weight.'
GROSS_WEIGHT_DIFFERENCE_MESSAGE = 'Difference must be 0.00.'

SALES_ISSUE_MESSAGES = {
    'MISSING_PRODUCT_CATEGORY_FOR_VALIDATION': (
        'Product category could not be determined for validation against the sales account.'
    ),
    'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT': (
        'Product category does not match the category implied by the sales account.'
    ),
    'CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT': (
        'Sales account differs from the dominant account used elsewhere for this product.'
    ),
    'GROSS_WEIGHT_OUTSIDE_TOLERANCE': (
        'Manual gross weight and auto gross weight differ by more than the configured tolerance.'
    ),
    'INVALID_SALES_ACCOUNT': (
        'Sales account was not found in the master sales verification sheet.'
    ),
    'INVALID_PRODUCT_MAPPING': 'Product mapping mismatch',
    'PRODUCT_NOT_FOUND_IN_MASTER': 'Product mapping mismatch',
    'INVALID_RATE_DEVIATION': 'Rate below allowed range',
    'INVALID_PRODUCT_PATTERN': (
        'Product matches a gemstone slab shape but the slab price could not be extracted.'
    ),
    'RATE_MASTER_NOT_FOUND': (
        'No product-wise sales rate rule was found in the master sales rate rules for this row.'
    ),
}

ALLOWED_EXTENSIONS = {'.xlsx', '.xlsm', '.xls'}
ALLOWED_MIME_TYPES = {
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
}

COMMON_EMPTY_VALUES = {'', 'na', 'n/a', 'none', 'null', 'nan'}

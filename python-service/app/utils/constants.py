PAN_REGEX = r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$'

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
}

ALLOWED_EXTENSIONS = {'.xlsx', '.xlsm', '.xls'}
ALLOWED_MIME_TYPES = {
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
}

COMMON_EMPTY_VALUES = {'', 'na', 'n/a', 'none', 'null', 'nan'}

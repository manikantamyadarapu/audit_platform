"""Constants for Financials Sales & Purchases product pivot."""

from typing import Final

# Scan report-export title/metadata rows above the transaction table.
HEADER_SCAN_LIMIT: Final = 80

# Normalized header keys (case/spacing insensitive via normalize_header).
# Matching is by name only — never by column index or Excel letter.
REQUIRED_COLUMN_KEYS: Final = {
    'product': 'Product',
    'quantity': 'Quantity',
    'gross_amount': 'Gross Amount',
}

REQUIRED_DISPLAY_COLUMNS: Final = ('Product', 'Quantity', 'Gross Amount')

PIVOT_COLUMNS: Final = ('product', 'sumOfQuantity', 'sumOfGross')
PIVOT_DISPLAY_HEADERS: Final = {
    'product': 'Product',
    'sumOfQuantity': 'Sum of Quantity',
    'sumOfGross': 'Sum of Gross',
}

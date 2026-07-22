"""Constants for TDS @ 0.1% (Section 194Q) purchase voucher audit."""

from typing import Final

FILE_TYPE: Final = 'tds_rate_01'

# Eligible when Purchases During Year > 50,00,000
PURCHASE_THRESHOLD: Final = 5_000_000.0
TDS_RATE: Final = 0.001  # 0.1%

EXPORT_FILENAME: Final = 'TDS_0_1_Report.xlsx'
SHEET_DETAILED: Final = 'Detailed'
SHEET_SUMMARY: Final = 'Summary'
EMPTY_SHEET_MESSAGE: Final = 'No eligible suppliers found.'

REQUIRED_COLUMNS: Final = frozenset({
    'date',
    'voucher_no',
    'party',
    'gross_amount',
})

OPTIONAL_COLUMNS: Final = frozenset({
    'branch',
    'pan',
})

# Normalized header aliases → canonical field names
HEADER_ALIASES: Final = {
    'date': 'date',
    'voucher_no': 'voucher_no',
    'voucher_number': 'voucher_no',
    'voucher': 'voucher_no',
    'vch_no': 'voucher_no',
    'party': 'party',
    'party_name': 'party',
    'supplier': 'party',
    'supplier_name': 'party',
    'account': 'party',
    'gross_amount': 'gross_amount',
    'gross_amt': 'gross_amount',
    'gross': 'gross_amount',
    'gross_amt_rs': 'gross_amount',
    'branch': 'branch',
    'pan': 'pan',
    'pan_no': 'pan',
    'pan_number': 'pan',
}

DETAILED_COLUMNS: Final = (
    'voucher_no',
    'date',
    'party',
    'gross_amount',
    'branch',
    'pan',
)

DETAILED_HEADER_MAP: Final = {
    'voucher_no': 'Voucher No',
    'date': 'Date',
    'party': 'Party',
    'gross_amount': 'Gross Amount',
    'branch': 'Branch',
    'pan': 'PAN',
}

SUMMARY_COLUMNS: Final = (
    'party',
    'purchases_during_year',
    'tds_deductible',
)

SUMMARY_HEADER_MAP: Final = {
    'party': 'Party',
    'purchases_during_year': 'Purchases During Year',
    'tds_deductible': 'TDS Deductible',
}

TABLE_EXPORT_COLUMNS: Final = SUMMARY_COLUMNS
TABLE_EXPORT_HEADER_MAP: Final = SUMMARY_HEADER_MAP

"""Constants for Party Wise TDS Summary."""

from typing import Final

FILE_TYPE: Final = 'party_wise_tds'

SOURCE_PURCHASE: Final = 'Purchase Goods'
SOURCE_PAYABLE: Final = 'TDS Payable'

SHEET_PURCHASE: Final = 'Purchase Goods Summary'
SHEET_PAYABLE: Final = 'TDS Payable Summary'

EXPORT_FILENAME: Final = 'Party_Wise_TDS_Summary.xlsx'
EMPTY_SHEET_MESSAGE: Final = 'No records found.'

SUMMARY_EXPORT_COLUMNS: Final = (
    'contra_account',
    'total_tds_amount',
)

SUMMARY_EXPORT_HEADER_MAP: Final = {
    'contra_account': 'Contra Account',
    'total_tds_amount': 'Total TDS Amount',
}

TABLE_EXPORT_COLUMNS: Final = (
    'contra_account',
    'total_tds_amount',
    'source',
)

TABLE_EXPORT_HEADER_MAP: Final = {
    'contra_account': 'Contra Account',
    'total_tds_amount': 'Total TDS Amount',
    'source': 'Source',
}

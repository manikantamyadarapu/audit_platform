"""Tests for Cash Ledger header detection and workbook loading."""

from io import BytesIO

import pandas as pd
import pytest

from app.engines.cash_ledger_engine.parsers.workbook_loader import (
    CASH_LEDGER_HEADER_SCAN_LIMIT,
    cash_ledger_header_row_matches,
    load_cash_ledger_workbook,
)
from app.utils.header_cleaner import normalize_header


def _build_tally_style_workbook() -> bytes:
    rows = [
        ['Company Name Pvt Ltd'],
        ['123 Main Street, City'],
        ['Ledger Remarks: Cash Book'],
        ['Report Information'],
        [''],
        [
            'SNo',
            'Date',
            'Voucher No',
            'Branch',
            'Contra Account',
            'Debit',
            'Credit',
            'Balance',
            'Remarks',
            'Division',
        ],
        [1, '01-04-2025', 'V001', 'HQ', 'Sales', 250000, None, '2,50,000 Dr', '', 'Retail'],
        [2, '02-04-2025', 'V002', 'HQ', 'Rent', None, 15000, '2,35,000 Dr', '', 'Retail'],
    ]
    buffer = BytesIO()
    pd.DataFrame(rows).to_excel(buffer, index=False, header=False)
    return buffer.getvalue()


def test_cash_ledger_header_row_matches_required_markers() -> None:
    labels = {
        'date',
        'voucher_no',
        'contra_account',
        'debit',
        'credit',
        'balance',
        'branch',
        'sno',
    }
    assert cash_ledger_header_row_matches(labels) is True

    assert cash_ledger_header_row_matches({'date', 'voucher_no', 'debit'}) is False


def test_normalize_header_strips_newlines() -> None:
    assert normalize_header('Voucher\nNo') == 'voucher_no'
    assert normalize_header('Contra\r\nAccount') == 'contra_account'


def test_load_cash_ledger_workbook_detects_row_6_as_header() -> None:
    loaded = load_cash_ledger_workbook(_build_tally_style_workbook())

    assert loaded.header_row_index == 5
    assert loaded.dataframe.height == 2

    columns = [
        column
        for column in loaded.dataframe.columns
        if not column.startswith('__') and column != 'source_excel_row_number'
    ]
    assert columns == [
        'sno',
        'date',
        'voucher_no',
        'branch',
        'contra_account',
        'debit',
        'credit',
        'balance',
        'remarks',
        'division',
    ]
    assert loaded.dataframe['source_excel_row_number'].to_list() == [7, 8]


def test_load_cash_ledger_workbook_ignores_grand_total_row() -> None:
    rows = [
        ['Company Name Pvt Ltd'],
        [''],
        [''],
        [''],
        [''],
        [
            'SNo',
            'Date',
            'Voucher No',
            'Branch',
            'Contra Account',
            'Debit',
            'Credit',
            'Balance',
            'Remarks',
            'Division',
        ],
        [1, '01-04-2025', 'V001', 'HQ', 'Sales', 250000, None, '2,50,000 Dr', '', 'Retail'],
        [None, None, None, None, None, '56,25,62,210.00', '55,18,59,678.00', None, None, None],
    ]
    buffer = BytesIO()
    pd.DataFrame(rows).to_excel(buffer, index=False, header=False)

    loaded = load_cash_ledger_workbook(buffer.getvalue())

    assert loaded.dataframe.height == 1
    assert loaded.dataframe['source_excel_row_number'].to_list() == [7]


def test_load_cash_ledger_workbook_stops_at_footer_rows() -> None:
    rows = [
        ['Company Name Pvt Ltd'],
        [''],
        [''],
        [''],
        [''],
        [
            'SNo',
            'Date',
            'Voucher No',
            'Branch',
            'Contra Account',
            'Debit',
            'Credit',
            'Balance',
            'Remarks',
            'Division',
        ],
        [1, '01-04-2025', 'V001', 'HQ', 'Sales', 250000, None, '2,50,000 Dr', '', 'Retail'],
        [2, '02-04-2025', 'V002', 'HQ', 'Rent', None, 15000, '2,35,000 Dr', '', 'Retail'],
        [None, None, None, None, None, '562,562,210.00', '551,859,678.00', None, None, None],
        [None, None, None, None, None, None, None, None, None, None],
        ['Date : 04/07/2026 11:32 AM', None, None, None, None, None, None, None, None, None],
        ['User Name : H A A', None, None, None, None, None, None, None, None, None],
        [3, '03-04-2025', 'V999', 'HQ', 'ShouldNotLoad', 1, None, '1 Dr', '', 'Retail'],
    ]
    buffer = BytesIO()
    pd.DataFrame(rows).to_excel(buffer, index=False, header=False)

    loaded = load_cash_ledger_workbook(buffer.getvalue())

    assert loaded.dataframe.height == 2
    assert loaded.dataframe['voucher_no'].to_list() == ['V001', 'V002']
    assert 'V999' not in loaded.dataframe['voucher_no'].to_list()


def test_header_scan_limit_is_twenty() -> None:
    assert CASH_LEDGER_HEADER_SCAN_LIMIT == 20


def test_load_raises_when_header_missing() -> None:
    rows = [
        ['Company Name'],
        ['Address line'],
        ['Some other report'],
    ]
    buffer = BytesIO()
    pd.DataFrame(rows).to_excel(buffer, index=False, header=False)

    from app.utils.sheet_validation_error import SheetValidationError

    with pytest.raises(SheetValidationError):
        load_cash_ledger_workbook(buffer.getvalue())

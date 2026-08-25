"""Form 269SS / 269ST combined audit tests."""

from __future__ import annotations

from io import BytesIO

import pandas as pd
import pytest

from app.engines.form269_engine.config.constants import (
    COL_AMOUNT,
    COL_LENDER_AADHAAR,
    COL_LENDER_ADDRESS,
    COL_LENDER_NAME,
    COL_LENDER_PAN,
    COL_MAXIMUM_OUTSTANDING,
    COL_SQUARED_UP,
    EXPORT_COLUMNS,
    EXPORT_HEADER_MAP,
)
from app.engines.form269_engine.engine.audit import Form269Audit
from app.engines.form269_engine.engine.calculator import (
    aggregate_file_rows,
    format_lender_display_name,
    is_cash_account,
    squared_up_status,
)
from app.engines.form269_engine.parsers.master_loader import (
    extract_lender_name,
    load_bundled_master_records,
    load_master_records,
    lookup_master_record,
)


def create_ledger_excel(rows: list[list], header_row: int = 2) -> bytes:
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        pd.DataFrame(rows).to_excel(writer, index=False, header=False, startrow=header_row)
    buffer.seek(0)
    return buffer.getvalue()


def create_legacy_ledger_xls(rows: list[list]) -> bytes:
    """Build a binary .xls workbook for legacy-format tests."""
    import xlwt

    buffer = BytesIO()
    book = xlwt.Workbook()
    sheet = book.add_sheet('Sheet1')
    for row_idx, row in enumerate(rows):
        for col_idx, value in enumerate(row):
            sheet.write(row_idx, col_idx, value)
    book.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


LEDGER_TEMPLATE = [
    ['Account: Sample Ledger'],
    [],
    ['Date', 'Voucher No', 'Branch', 'Contra Account', 'Debit', 'Credit', 'Balance'],
]

FULL_LEDGER_HEADER = [
    'SNo',
    'Date',
    'Voucher No',
    'Branch',
    'Contra Account',
    'Debit',
    'Credit',
    'Balance',
    'Division',
    'Remarks',
    'Comments',
    'Cheque No',
    'Cheque Date',
]


class TestNameAndTotals:
    def test_extract_lender_name_from_filename(self):
        assert extract_lender_name('Shree Jewellers.xlsx') == 'Shree Jewellers'
        assert extract_lender_name('path/Smt. Nitika Gupta.xls') == 'Smt. Nitika Gupta'

    def test_cash_account_detection(self):
        assert is_cash_account('Cash Account') is True
        assert is_cash_account('HDFC Bank') is False

    def test_balance_bf_excluded_from_totals(self):
        rows = [
            {'contra_account': 'Cash Account', 'debit': 1000, 'credit': 0, 'balance': 1000},
            {'contra_account': 'Balance b/f', 'debit': 5000, 'credit': 0, 'balance': 6000},
            {'contra_account': 'HDFC Bank', 'debit': 0, 'credit': 2500, 'balance': 3500},
        ]
        totals = aggregate_file_rows(rows)
        assert totals.cash.debit_sum == 1000.0
        assert totals.cash.credit_sum == 0.0
        assert totals.bank.credit_sum == 2500.0
        assert totals.cash.row_count == 1
        assert totals.bank.row_count == 1

    def test_squared_up_yes_when_last_balance_non_zero(self):
        assert squared_up_status(1500.0) == 'Yes'

    def test_squared_up_no_when_last_balance_zero(self):
        assert squared_up_status(0.0) == 'No'
        assert squared_up_status(None) == 'No'

    def test_lender_display_name_format(self):
        display = format_lender_display_name(
            {
                'name': 'Shree Jewellers',
                'address': '3-6-354/1, Basheerbagh, Hyderabad',
                'pan': 'ADOPK6353R',
                'aadhaar': '',
            },
            'Bank Account',
        )
        assert display == 'Shree Jewellers (Bank Account)'


class TestMasterLookup:
    def test_bundled_master_file_loads(self):
        records = load_bundled_master_records()
        assert 'shree_jewellers' in records
        assert records['shree_jewellers']['pan'] == 'ADOPK6353R'
        assert records['shree_jewellers']['aadhaar'] == ''

    def test_master_lookup_populates_details(self):
        import json

        master_json = json.dumps(
            [
                {
                    'name': 'Smt. Nitika Gupta',
                    'address': '8-2-682/B/6/B, R.No. 12, Banjara Hills, Hyderabad',
                    'pan': 'AGFPN3027P',
                    'aadhaar': '123456789012',
                }
            ]
        )
        records = load_master_records(master_json)
        matched = lookup_master_record('Smt. Nitika Gupta.xlsx', records)
        assert matched['address'] == '8-2-682/B/6/B, R.No. 12, Banjara Hills, Hyderabad'
        assert matched['pan'] == 'AGFPN3027P'
        assert matched['aadhaar'] == '123456789012'

    def test_blank_aadhaar_when_unavailable(self):
        records = load_bundled_master_records()
        matched = lookup_master_record('Smt. Sarita Devi', records)
        assert matched['pan'] == 'ACZPD9105A'
        assert matched['aadhaar'] == ''


class TestCombinedAudit:
    def _build_fixture_files(self):
        lender_one_rows = LEDGER_TEMPLATE + [
            ['2024-01-01', 'V001', 'HO', 'Cash Account', 1000, 0, 1000],
            ['2024-01-02', 'V002', 'HO', 'Balance b/f', 5000, 0, 6000],
            ['2024-01-03', 'V003', 'HO', 'Cash Account', 0, 3000, 4000],
            ['2024-01-04', 'V004', 'HO', 'HDFC Bank', 0, 2000, 2000],
            ['2024-01-05', 'V005', 'HO', 'HDFC Bank', 500, 0, 1500],
        ]
        lender_two_rows = LEDGER_TEMPLATE + [
            ['2024-02-01', 'V101', 'BR1', 'Cash Account', 0, 1200, 1200],
            ['2024-02-02', 'V102', 'BR1', 'Cash Account', 0, 800, 0],
            ['2024-02-03', 'V103', 'BR1', 'Axis Bank', 400, 0, 400],
        ]
        return [
            ('Shree Jewellers.xlsx', create_ledger_excel(lender_one_rows)),
            ('Smt. Nitika Gupta.xlsx', create_ledger_excel(lender_two_rows)),
        ]

    def test_process_generates_both_269ss_and_269st(self):
        result = Form269Audit().process(self._build_fixture_files())
        assert result['success'] is True
        assert result['totalInputFiles'] == 2
        assert len(result['records269SS']) == 4
        assert len(result['records269ST']) == 4

    def test_output_columns_match_statutory_headers(self):
        result = Form269Audit().process(self._build_fixture_files())
        row = result['records269SS'][0]
        assert list(row.keys()) == list(EXPORT_COLUMNS)
        assert len(EXPORT_COLUMNS) == 11
        assert 'group' not in row
        assert result['exportColumns'] == list(EXPORT_COLUMNS)
        assert result['columnDisplayHeaders'] == dict(EXPORT_HEADER_MAP)
        assert list(EXPORT_HEADER_MAP.values()) == [
            'Name of lender or depositor',
            'Address of lender or depositor',
            'PAN of the lender or depositor(optional)',
            'Aadhaar no (optional)',
            'Amount of loan or deposit taken or accepted',
            'Whether the loan/deposit was squared up during the Previous Year',
            'Maximum amount outstanding in the account at any time during the previous year',
            (
                'Whether the loan or deposit was taken or accepted by cheque or bank draft '
                'or use of the electronic clearing system through a bank account'
            ),
            'Code of the nature of such amount (as mentioned in field (iv) above)',
            'Please specify',
            (
                'In case of loan or deposit was taken or deposit was accepted by cheque or bank draft '
                'whether the same was taken or accepted by an account payee cheque or an account payee bank draft'
            ),
        ]

    def test_269ss_credit_calculations(self):
        result = Form269Audit().process(self._build_fixture_files())
        shree_cash = next(
            row
            for row in result['records269SS']
            if row[COL_LENDER_NAME] == 'Shree Jewellers (Cash Account)'
        )
        shree_bank = next(
            row
            for row in result['records269SS']
            if row[COL_LENDER_NAME] == 'Shree Jewellers (Bank Account)'
        )
        nitika_cash = next(
            row
            for row in result['records269SS']
            if row[COL_LENDER_NAME] == 'Smt. Nitika Gupta (Cash Account)'
        )

        assert shree_cash[COL_AMOUNT] == 3000.0
        assert shree_cash[COL_MAXIMUM_OUTSTANDING] == 3000.0
        assert shree_cash[COL_SQUARED_UP] == 'Yes'
        assert shree_cash[COL_LENDER_PAN] == 'ADOPK6353R'
        assert shree_cash[COL_LENDER_ADDRESS] == '3-6-354/1, Basheerbagh, Hyderabad'
        assert shree_cash[COL_LENDER_AADHAAR] == ''
        assert shree_bank[COL_AMOUNT] == 2000.0
        assert shree_bank[COL_MAXIMUM_OUTSTANDING] == 2000.0
        assert nitika_cash[COL_AMOUNT] == 2000.0
        assert nitika_cash[COL_SQUARED_UP] == 'No'
        assert nitika_cash[COL_LENDER_PAN] == 'AGFPN3027P'

    def test_269st_debit_calculations(self):
        result = Form269Audit().process(self._build_fixture_files())
        shree_cash = next(
            row
            for row in result['records269ST']
            if row[COL_LENDER_NAME] == 'Shree Jewellers (Cash Account)'
        )
        shree_bank = next(
            row
            for row in result['records269ST']
            if row[COL_LENDER_NAME] == 'Shree Jewellers (Bank Account)'
        )

        assert shree_cash[COL_AMOUNT] == 1000.0
        assert shree_cash[COL_MAXIMUM_OUTSTANDING] == 1000.0
        assert shree_bank[COL_AMOUNT] == 500.0
        assert shree_bank[COL_MAXIMUM_OUTSTANDING] == 500.0

    def test_case_insensitive_header_matching(self):
        mixed_case_template = [
            ['Account: Sample Ledger'],
            [],
            ['SNO', 'DATE', 'VOUCHER NO', 'BRANCH', 'CONTRA ACCOUNT', 'DEBIT', 'CREDIT', 'BALANCE'],
        ]
        rows = mixed_case_template + [
            ['1', '2024-01-01', 'V001', 'HO', 'Cash Account', 500, 0, 500],
            ['2', '2024-01-02', 'V002', 'HO', 'HDFC Bank', 0, 1500, 2000],
        ]
        excel = create_ledger_excel(rows)
        result = Form269Audit().process([('Mixed Case Lender.xlsx', excel)])
        assert result['success'] is True
        assert len(result['records269SS']) == 2
        cash_row = next(
            row for row in result['records269SS'] if '(Cash Account)' in row[COL_LENDER_NAME]
        )
        assert cash_row[COL_AMOUNT] == 0.0
        bank_row = next(
            row for row in result['records269SS'] if '(Bank Account)' in row[COL_LENDER_NAME]
        )
        assert bank_row[COL_AMOUNT] == 1500.0

    def test_legacy_xls_workbook_with_full_columns(self):
        rows = [
            ['Account: Smt. Arpita Agarwal'],
            [],
            [
                'SNo',
                'Date',
                'Voucher No',
                'Branch',
                'Contra Account',
                'DEBIT',
                'credit',
                'Balance',
                'Division',
                'Remarks',
                'Comments',
                'Cheque No',
                'Cheque Date',
            ],
            [1, '2024-04-01', 'V001', 'HO', 'Cash Account', 0, 5000, 5000, '', '', '', '', ''],
            [2, '2024-04-02', 'V002', 'HO', 'HDFC Bank', 0, 3000, 8000, '', '', '', 'CHQ1', '2024-04-02'],
            [3, '2024-04-03', 'V003', 'HO', 'Cash Account', 2000, 0, 6000, '', '', '', '', ''],
        ]
        xls_bytes = create_legacy_ledger_xls(rows)
        result = Form269Audit().process([('1. Smt. Arpita Agarwal.xls', xls_bytes)])
        assert result['success'] is True
        assert result['totalInputFiles'] == 1
        assert len(result['records269SS']) == 2
        cash_ss = next(
            row for row in result['records269SS'] if '(Cash Account)' in row[COL_LENDER_NAME]
        )
        bank_ss = next(
            row for row in result['records269SS'] if '(Bank Account)' in row[COL_LENDER_NAME]
        )
        assert cash_ss[COL_AMOUNT] == 5000.0
        assert bank_ss[COL_AMOUNT] == 3000.0
        st_cash = next(
            row for row in result['records269ST'] if '(Cash Account)' in row[COL_LENDER_NAME]
        )
        assert st_cash[COL_AMOUNT] == 2000.0


@pytest.mark.parametrize(
    'filename,expected',
    [
        ('Shree Jewellers.xlsx', 'Shree Jewellers'),
        ('nested/Smt. Nitika Gupta.xls', 'Smt. Nitika Gupta'),
    ],
)
def test_dynamic_filename_extraction(filename, expected):
    assert extract_lender_name(filename) == expected


def test_form269_api_returns_json_for_folder_files():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    files = TestCombinedAudit()._build_fixture_files()
    response = client.post(
        '/api/v1/process/form-269',
        files=[
            (
                'input_files',
                (name, content, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
            )
            for name, content in files
        ],
    )
    assert response.status_code == 200
    body = response.json()
    assert body['success'] is True
    assert body['totalInputFiles'] == 2
    assert len(body['exportColumns']) == 11
    assert body['columnDisplayHeaders'][COL_LENDER_NAME] == 'Name of lender or depositor'
    assert list(body['records269SS'][0].keys()) == list(EXPORT_COLUMNS)
    assert any(
        row[COL_LENDER_NAME] == 'Shree Jewellers (Bank Account)'
        for row in body['records269SS']
    )
    st_cash = next(
        row
        for row in body['records269ST']
        if row[COL_LENDER_NAME] == 'Shree Jewellers (Cash Account)'
    )
    assert st_cash[COL_AMOUNT] == 1000.0

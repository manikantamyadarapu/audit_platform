"""Tests for Party Wise TDS Summary grouping logic."""

from app.engines.party_wise_tds_engine.config.constants import SOURCE_PAYABLE, SOURCE_PURCHASE
from app.engines.party_wise_tds_engine.engine.summary import (
    summarize_purchase_goods,
    summarize_tds_payable,
)
from app.utils.excel_exporter import export_party_wise_tds_summary


def test_groups_contra_account_and_sums_credit():
    rows = [
        {'date': '01-04-2025', 'voucher_no': 'V1', 'contra_account': 'Sri Hyderabad Hallmarking Centre', 'credit': '48'},
        {'date': '02-04-2025', 'voucher_no': 'V2', 'contra_account': 'Sri Hyderabad Hallmarking Centre', 'credit': '25'},
        {'date': '03-04-2025', 'voucher_no': 'V3', 'contra_account': 'Sri Hyderabad Hallmarking Centre', 'credit': '11'},
        {'date': '04-04-2025', 'voucher_no': 'V4', 'contra_account': 'Sri Hyderabad Hallmarking Centre', 'credit': '17'},
        {'date': '05-04-2025', 'voucher_no': 'V5', 'contra_account': 'Other Party', 'credit': '10'},
    ]
    summary = summarize_purchase_goods(rows)
    by_party = {row['contra_account']: row for row in summary}
    assert by_party['Sri Hyderabad Hallmarking Centre']['total_tds_amount'] == 101.0
    assert by_party['Sri Hyderabad Hallmarking Centre']['source'] == SOURCE_PURCHASE
    assert by_party['Other Party']['total_tds_amount'] == 10.0


def test_skips_footer_and_total_rows():
    rows = [
        {'date': '01-04-2025', 'voucher_no': 'V1', 'contra_account': 'Party A', 'credit': '100'},
        {'date': None, 'voucher_no': None, 'contra_account': None, 'debit': '100', 'credit': '100', 'balance': None},
        {'date': 'Date : 01-04-2025', 'voucher_no': None, 'contra_account': None, 'credit': None},
    ]
    summary = summarize_tds_payable(rows)
    assert len(summary) == 1
    assert summary[0]['contra_account'] == 'Party A'
    assert summary[0]['total_tds_amount'] == 100.0
    assert summary[0]['source'] == SOURCE_PAYABLE


def test_export_creates_two_sheets_even_when_empty():
    workbook_bytes = export_party_wise_tds_summary(purchase_summary=[], payable_summary=[])
    assert workbook_bytes[:2] == b'PK'  # zip/xlsx
    import pandas as pd
    from io import BytesIO

    sheets = pd.read_excel(BytesIO(workbook_bytes), sheet_name=None, header=None)
    assert 'Purchase Goods Summary' in sheets
    assert 'TDS Payable Summary' in sheets
    assert 'No records found.' in str(sheets['Purchase Goods Summary'].iloc[0, 0])

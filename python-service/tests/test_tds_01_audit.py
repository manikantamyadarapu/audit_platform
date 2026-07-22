"""Tests for TDS @ 0.1% supplier eligibility and report generation."""

from app.engines.tds_01_engine.config.constants import PURCHASE_THRESHOLD, TDS_RATE
from app.engines.tds_01_engine.engine.report_generator import generate_tds_01_workbook
from app.engines.tds_01_engine.engine.tds_calculator import build_tds_report_frames


def test_eligible_supplier_tds_calculation():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'P1',
            'party': 'Alpha Traders',
            'gross_amount': '30,00,000',
            '__original_order': 0,
        },
        {
            'date': '02-04-2025',
            'voucher_no': 'P2',
            'party': 'Alpha Traders',
            'gross_amount': '25,00,001',
            '__original_order': 1,
        },
        {
            'date': '03-04-2025',
            'voucher_no': 'P3',
            'party': 'Beta Corp',
            'gross_amount': '10,00,000',
            '__original_order': 2,
        },
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert metrics['eligibleSuppliers'] == 1
    assert metrics['nonEligibleSuppliers'] == 1
    assert len(summary) == 1
    assert summary.iloc[0]['party'] == 'Alpha Traders'
    assert summary.iloc[0]['purchases_during_year'] == 5500001.0
    assert summary.iloc[0]['purchases_during_year'] > PURCHASE_THRESHOLD
    assert summary.iloc[0]['tds_deductible'] == round(5500001.0 * TDS_RATE, 2)
    assert len(detailed) == 2
    assert list(detailed['voucher_no']) == ['P1', 'P2']


def test_threshold_is_exclusive():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'P1',
            'party': 'Exact Limit',
            'gross_amount': '5000000',
            '__original_order': 0,
        },
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['eligibleSuppliers'] == 0
    assert len(summary) == 0
    assert len(detailed) == 0


def test_trims_party_and_skips_blank_rows():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'P1',
            'party': '  Acme   Jewels  ',
            'gross_amount': '60,00,000.50',
            '__original_order': 0,
        },
        {
            'date': None,
            'voucher_no': None,
            'party': None,
            'gross_amount': '100',
            '__original_order': 1,
        },
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['totalRecords'] == 1
    assert summary.iloc[0]['party'] == 'Acme Jewels'
    assert summary.iloc[0]['purchases_during_year'] == 6000000.5


def test_export_creates_detailed_and_summary_sheets():
    workbook_bytes = generate_tds_01_workbook(
        detailed_rows=[],
        summary_rows=[],
    )
    assert workbook_bytes[:2] == b'PK'
    import pandas as pd
    from io import BytesIO

    sheets = pd.read_excel(BytesIO(workbook_bytes), sheet_name=None, header=None)
    assert 'Detailed' in sheets
    assert 'Summary' in sheets
    assert 'No eligible suppliers found.' in str(sheets['Detailed'].iloc[0, 0])

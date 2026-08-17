"""Tests for TDS @ 0.1% supplier eligibility and report generation."""

import pandas as pd

from app.engines.tds_01_engine.config.constants import PURCHASE_THRESHOLD, TDS_RATE
from app.engines.tds_01_engine.engine.audit import _serialize_summary_rows
from app.engines.tds_01_engine.engine.report_generator import generate_tds_01_workbook
from app.engines.tds_01_engine.engine.tds_calculator import build_tds_report_frames


def test_eligible_supplier_tds_calculation():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'BB/PV-001',
            'party': 'Alpha Traders',
            'branch': 'BB',
            'pan': 'ABCDE1234F',
            'gross_amount': '30,00,000',
            '__original_order': 0,
        },
        {
            'date': '02-04-2025',
            'voucher_no': 'BB/PV-002',
            'party': 'Alpha Traders',
            'branch': 'BB',
            'pan': 'ABCDE1234F',
            'gross_amount': '25,00,001',
            '__original_order': 1,
        },
        {
            'date': '03-04-2025',
            'voucher_no': 'BB/PV-003',
            'party': 'Beta Corp',
            'branch': 'BB',
            'pan': 'ABCDE1234F',
            'gross_amount': '10,00,000',
            '__original_order': 2,
        },
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert metrics['eligibleSuppliers'] == 1
    assert metrics['nonEligibleSuppliers'] == 1
    assert len(summary) == 1
    assert summary.iloc[0]['party'] == 'Alpha Traders'
    assert summary.iloc[0]['purchase_during_year'] == 5500001.0
    assert summary.iloc[0]['purchase_during_year'] > PURCHASE_THRESHOLD
    assert summary.iloc[0]['tds'] == round(5500001.0 * TDS_RATE, 2)
    assert len(detailed) == 2
    assert list(detailed['voucher_no']) == ['BB/PV-001', 'BB/PV-002']


def test_threshold_is_exclusive():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'BB/PV-001',
            'party': 'Exact Limit',
            'branch': 'BB',
            'pan': 'ABCDE1234F',
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
            'voucher_no': 'BB/PV-001',
            'party': '  Acme   Jewels  ',
            'branch': 'BB',
            'pan': 'ABCDE1234F',
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
    assert summary.iloc[0]['purchase_during_year'] == 6000000.5


def test_branch_bb_cp_is_b2c_and_subtracts_threshold_with_pan():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'BB/CP-001',
            'party': 'BB Traders',
            'branch': 'BB',
            'pan': 'ABCDE1234F',
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert len(summary) == 1
    assert summary.iloc[0]['party'] == 'BB Traders'
    assert summary.iloc[0]['purchase_during_year'] == 6000000.0
    assert summary.iloc[0]['transaction_type'] == 'B2C'
    assert summary.iloc[0]['tds'] == 1000.0
    assert metrics['totalTdsDeductible'] == 1000.0


def test_branch_bb_pv_is_b2b_and_uses_full_purchase_with_pan():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'BB/PV-001',
            'party': 'BB Traders',
            'branch': 'BB',
            'pan': 'ABCDE1234F',
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert len(summary) == 1
    assert summary.iloc[0]['party'] == 'BB Traders'
    assert summary.iloc[0]['purchase_during_year'] == 6000000.0
    assert summary.iloc[0]['transaction_type'] == 'B2B'
    assert summary.iloc[0]['tds'] == 6000.0
    assert metrics['totalTdsDeductible'] == 6000.0


def test_branch_ho_pv_is_b2b_and_uses_full_purchase_with_pan():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'JH/PV-001',
            'party': 'HO Traders',
            'branch': 'HO',
            'pan': 'ABCDE1234F',
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert len(summary) == 1
    assert summary.iloc[0]['party'] == 'HO Traders'
    assert summary.iloc[0]['purchase_during_year'] == 6000000.0
    assert summary.iloc[0]['transaction_type'] == 'B2B'
    assert summary.iloc[0]['tds'] == 6000.0
    assert metrics['totalTdsDeductible'] == 6000.0


def test_branch_ho_cp_is_b2c_and_subtracts_threshold_with_pan():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'JH/CP-001',
            'party': 'HO Traders',
            'branch': 'HO',
            'pan': 'ABCDE1234F',
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert len(summary) == 1
    assert summary.iloc[0]['party'] == 'HO Traders'
    assert summary.iloc[0]['purchase_during_year'] == 6000000.0
    assert summary.iloc[0]['transaction_type'] == 'B2C'
    assert summary.iloc[0]['tds'] == 1000.0
    assert metrics['totalTdsDeductible'] == 1000.0


def test_branch_ho_bb_pv_uses_standard_tds_calculation():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'BB/PV-001',
            'party': 'HO Traders',
            'branch': 'HO',
            'pan': 'ABCDE1234F',
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert len(summary) == 1
    assert summary.iloc[0]['party'] == 'HO Traders'
    assert summary.iloc[0]['purchase_during_year'] == 6000000.0
    assert summary.iloc[0]['tds'] == 6000.0
    assert metrics['totalTdsDeductible'] == 6000.0


def test_mixed_b2b_b2c_party_is_reported_without_tds_calculation():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'JH/CP-001',
            'party': 'HO Traders',
            'branch': 'HO',
            'pan': 'ABCDE1234F',
            'gross_amount': '10,00,000',
            '__original_order': 0,
        },
        {
            'date': '01-04-2025',
            'voucher_no': 'JH/PV-001',
            'party': 'HO Traders',
            'branch': 'HO',
            'pan': 'ABCDE1234F',
            'gross_amount': '60,00,000',
            '__original_order': 1,
        },
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert metrics['mixedParties'] == 1
    assert metrics['mixedPartyNames'] == ['HO Traders']
    assert metrics['totalTdsDeductible'] == 0.0
    assert len(summary) == 0
    assert len(detailed) == 0


def test_branch_kt_pv_is_b2c_and_subtracts_threshold_with_pan():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'PV-001',
            'party': 'KT Traders',
            'branch': 'KT',
            'pan': 'ABCDE1234F',
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert 'branch' in detailed.columns
    assert len(summary) == 1
    assert summary.iloc[0]['transaction_type'] == 'B2C'
    assert summary.iloc[0]['tds'] == 1000.0
    assert len(detailed) == 1
    assert metrics['eligibleSuppliers'] == 1
    assert metrics['totalTdsDeductible'] == 1000.0


def test_b2b_missing_pan_uses_five_percent_on_full_purchase():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'BB/PV-001',
            'party': 'No Pan Traders',
            'branch': 'BB',
            'pan': '   ',
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, _detailed, metrics = build_tds_report_frames(rows)

    assert summary.iloc[0]['transaction_type'] == 'B2B'
    assert not bool(summary.iloc[0]['pan_available'])
    assert summary.iloc[0]['tds'] == 300000.0
    assert metrics['totalTdsDeductible'] == 300000.0


def test_b2c_missing_pan_uses_five_percent_on_excess_purchase():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'KT/PV-001',
            'party': 'No Pan B2C',
            'branch': 'KT',
            'pan': None,
            'gross_amount': '60,00,000',
            '__original_order': 0,
        }
    ]
    _frame, summary, _detailed, metrics = build_tds_report_frames(rows)

    assert summary.iloc[0]['transaction_type'] == 'B2C'
    assert not bool(summary.iloc[0]['pan_available'])
    assert summary.iloc[0]['tds'] == 50000.0
    assert metrics['totalTdsDeductible'] == 50000.0


def test_summary_rows_preserve_special_tds_deductible_values():
    summary_df = pd.DataFrame([
        {
            'party': 'KT Traders',
            'purchase_during_year': -98765.0,
            'tds': '0.1%',
        }
    ])

    rows = _serialize_summary_rows(summary_df)

    assert rows[0]['party'] == 'KT Traders'
    assert rows[0]['purchase_during_year'] == -98765.0
    assert rows[0]['tds'] == '0.1%'
    assert rows[0]['purchases_during_year'] == -98765.0
    assert rows[0]['tds_deductible'] == '0.1%'


def test_multiple_pv_voucher_with_branch_kt_rows_build_summary_without_error():
    rows = [
        {
            'date': '01-04-2025',
            'voucher_no': 'PV-001',
            'party': 'KT Traders',
            'branch': 'KT',
            'gross_amount': '1,00,000',
            '__original_order': 0,
        },
        {
            'date': '02-04-2025',
            'voucher_no': 'PV-002',
            'party': 'KT Traders',
            'branch': 'KT',
            'gross_amount': '2,00,000',
            '__original_order': 1,
        },
        {
            'date': '03-04-2025',
            'voucher_no': 'PV-003',
            'party': 'Other Traders',
            'branch': 'KT',
            'gross_amount': '3,00,000',
            '__original_order': 2,
        },
    ]

    _frame, summary, detailed, metrics = build_tds_report_frames(rows)

    assert len(summary) == 0
    assert len(detailed) == 0
    assert metrics['eligibleSuppliers'] == 0
    assert metrics['totalTdsDeductible'] == 0.0


def test_export_creates_detailed_and_summary_sheets():
    workbook_bytes = generate_tds_01_workbook(
        detailed_rows=[],
        summary_rows=[],
    )
    assert workbook_bytes[:2] == b'PK'
    from io import BytesIO

    sheets = pd.read_excel(BytesIO(workbook_bytes), sheet_name=None, header=None)
    assert 'Detailed' in sheets
    assert 'Summary' in sheets
    assert 'No eligible suppliers found.' in str(sheets['Detailed'].iloc[0, 0])


def test_summary_sheet_contains_only_requested_columns():
    workbook_bytes = generate_tds_01_workbook(
        detailed_rows=[],
        summary_rows=[
            {
                'party': 'Alpha Traders',
                'purchase_during_year': 6000000.0,
                'tds': 6000.0,
                'purchases_during_year': 6000000.0,
                'tds_deductible': 6000.0,
            }
        ],
    )
    from io import BytesIO

    sheets = pd.read_excel(BytesIO(workbook_bytes), sheet_name=None)
    assert list(sheets['Summary'].columns) == ['Party', 'Purchase During the Year', 'TDS']

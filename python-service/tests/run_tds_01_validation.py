"""
TDS @ 0.1% end-to-end validation harness (dummy data).

Does NOT modify audit logic. Reports PASS/FAIL for every controlled scenario.
Run:
  python -m tests.run_tds_01_validation
or:
  PYTHONPATH=. python tests/run_tds_01_validation.py
"""

from __future__ import annotations

import io
import traceback
from dataclasses import dataclass
from time import perf_counter
from typing import Any, Callable

import pandas as pd
from fastapi.testclient import TestClient

from app.engines.cash_ledger_engine.parsers.parser import parse_amount
from app.engines.tds_01_engine.config.constants import (
    DETAILED_HEADER_MAP,
    PURCHASE_THRESHOLD,
    SUMMARY_HEADER_MAP,
    TDS_RATE,
)
from app.engines.tds_01_engine.engine.output import build_tds_01_response
from app.engines.tds_01_engine.engine.processor import Tds01Processor
from app.engines.tds_01_engine.engine.report_generator import generate_tds_01_workbook
from app.engines.tds_01_engine.engine.tds_calculator import build_tds_report_frames
from app.engines.tds_01_engine.parsers.excel_parser import (
    load_purchase_voucher_workbook,
    validate_required_columns,
)
from app.main import app
from app.utils.sheet_validation_error import SheetValidationError


@dataclass
class CaseResult:
    name: str
    status: str  # PASS | FAIL
    detail: str = ''
    root_cause: str = ''
    location: str = ''
    suggested_fix: str = ''
    elapsed_ms: float = 0.0


RESULTS: list[CaseResult] = []


def _row(
    party: str,
    amount: Any,
    *,
    voucher: str = 'V1',
    date: str = '01-04-2025',
    order: int = 0,
    branch: str = '',
    pan: str = '',
) -> dict[str, Any]:
    return {
        'date': date,
        'voucher_no': voucher,
        'party': party,
        'gross_amount': amount,
        'branch': branch,
        'pan': pan,
        '__original_order': order,
    }


def _excel_bytes(rows: list[dict[str, Any]], *, include_preamble: bool = True) -> bytes:
    """Build a temporary Purchase Voucher Listing workbook."""
    buffer = io.BytesIO()
    frame = pd.DataFrame(
        [
            {
                'Date': r.get('date'),
                'Voucher No': r.get('voucher_no'),
                'Party': r.get('party'),
                'Gross Amount': r.get('gross_amount'),
                'Branch': r.get('branch', ''),
                'PAN': r.get('pan', ''),
            }
            for r in rows
        ]
    )
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        start = 0
        if include_preamble:
            pd.DataFrame([['Company ABC'], ['Purchase Voucher Listing FY 2025-26']]).to_excel(
                writer, index=False, header=False, sheet_name='Sheet1', startrow=0
            )
            start = 3
        frame.to_excel(writer, index=False, sheet_name='Sheet1', startrow=start)
    return buffer.getvalue()


def _fail_info(exc: BaseException) -> tuple[str, str, str]:
    tb = traceback.extract_tb(exc.__traceback__)
    # Prefer project frame over this harness when available
    project_frames = [f for f in tb if 'tds_01_engine' in (f.filename or '').replace('\\', '/')]
    frame = project_frames[-1] if project_frames else (tb[-1] if tb else None)
    if frame is None:
        return str(exc), '', 'Inspect failure detail and re-run the case.'
    location = f'{frame.filename} :: {frame.name} :: line {frame.lineno}'
    return str(exc), location, 'Review the failing assertion against business rules before changing logic.'


def run_case(name: str, fn: Callable[[], None]) -> None:
    started = perf_counter()
    try:
        fn()
        RESULTS.append(
            CaseResult(
                name=name,
                status='PASS',
                elapsed_ms=(perf_counter() - started) * 1000,
            )
        )
    except Exception as exc:  # noqa: BLE001 — harness must capture every failure
        root, location, fix = _fail_info(exc)
        RESULTS.append(
            CaseResult(
                name=name,
                status='FAIL',
                detail=str(exc),
                root_cause=root,
                location=location,
                suggested_fix=fix,
                elapsed_ms=(perf_counter() - started) * 1000,
            )
        )


# ---------------------------------------------------------------------------
# Controlled scenarios
# ---------------------------------------------------------------------------


def case_01_single_eligible_60l() -> None:
    rows = [_row('Supplier One', '60,00,000')]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['eligibleSuppliers'] == 1
    assert metrics['totalTdsDeductible'] == 6000.0
    assert summary.iloc[0]['tds_deductible'] == 6000.0
    assert len(detailed) == 1


def case_02_single_below_threshold() -> None:
    rows = [_row('Supplier Two', '49,99,999')]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['eligibleSuppliers'] == 0
    assert metrics['totalTdsDeductible'] == 0.0
    assert len(summary) == 0
    assert len(detailed) == 0


def case_03_multi_voucher_53l() -> None:
    rows = [
        _row('Multi Voucher Co', '20,00,000', voucher='P1', order=0),
        _row('Multi Voucher Co', '15,00,000', voucher='P2', order=1),
        _row('Multi Voucher Co', '18,00,000', voucher='P3', order=2),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['eligibleSuppliers'] == 1
    assert summary.iloc[0]['purchases_during_year'] == 5300000.0
    assert summary.iloc[0]['tds_deductible'] == 5300.0
    assert list(detailed['voucher_no']) == ['P1', 'P2', 'P3']


def case_04_exact_50l_not_eligible() -> None:
    rows = [_row('Exact Fifty', '50,00,000')]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert PURCHASE_THRESHOLD == 5_000_000.0
    assert metrics['eligibleSuppliers'] == 0
    assert metrics['totalTdsDeductible'] == 0.0
    assert len(summary) == 0
    assert len(detailed) == 0


def case_05_multiple_suppliers() -> None:
    rows = [
        _row('Supplier A', '60,00,000', voucher='A1', order=0),
        _row('Supplier B', '35,00,000', voucher='B1', order=1),
        _row('Supplier C', '75,00,000', voucher='C1', order=2),
        _row('Supplier D', '12,00,000', voucher='D1', order=3),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    eligible = set(summary['party'].tolist())
    assert eligible == {'Supplier A', 'Supplier C'}
    assert metrics['eligibleSuppliers'] == 2
    assert metrics['nonEligibleSuppliers'] == 2
    assert set(detailed['party'].tolist()) == {'Supplier A', 'Supplier C'}
    assert 'Supplier B' not in detailed['party'].tolist()
    assert 'Supplier D' not in detailed['party'].tolist()


def case_06_duplicate_supplier_grouping() -> None:
    rows = [
        _row('ABC', '10,00,000', voucher='1', order=0),
        _row('ABC', '20,00,000', voucher='2', order=1),
        _row('ABC', '15,00,000', voucher='3', order=2),
        _row('ABC', '10,00,000', voucher='4', order=3),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['totalParties'] == 1
    assert metrics['eligibleSuppliers'] == 1
    assert summary.iloc[0]['purchases_during_year'] == 5500000.0
    assert summary.iloc[0]['tds_deductible'] == 5500.0
    assert len(detailed) == 4


def case_07_party_name_whitespace() -> None:
    rows = [
        _row(' ABC ', '20,00,000', voucher='1', order=0),
        _row('ABC', '20,00,000', voucher='2', order=1),
        _row('ABC ', '20,00,000', voucher='3', order=2),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['totalParties'] == 1
    assert summary.iloc[0]['party'] == 'ABC'
    assert summary.iloc[0]['purchases_during_year'] == 6000000.0
    assert set(detailed['party'].tolist()) == {'ABC'}


def case_08_blank_rows_ignored() -> None:
    rows = [
        _row('Keep Me', '60,00,000', voucher='K1', order=0),
        {
            'date': None,
            'voucher_no': None,
            'party': None,
            'gross_amount': None,
            '__original_order': 1,
        },
        {
            'date': '',
            'voucher_no': '',
            'party': '   ',
            'gross_amount': '',
            '__original_order': 2,
        },
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['totalRecords'] == 1
    assert metrics['eligibleSuppliers'] == 1
    assert len(detailed) == 1


def case_09_missing_gross_amount_skipped() -> None:
    """Project standard: skip rows with missing Gross Amount (do not fail whole file)."""
    rows = [
        _row('Has Amount', '60,00,000', voucher='H1', order=0),
        {
            'date': '02-04-2025',
            'voucher_no': 'H2',
            'party': 'Missing Gross',
            'gross_amount': None,
            '__original_order': 1,
        },
        {
            'date': '03-04-2025',
            'voucher_no': 'H3',
            'party': 'Empty Gross',
            'gross_amount': '',
            '__original_order': 2,
        },
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['totalRecords'] == 1
    assert set(_frame['party'].tolist()) == {'Has Amount'}
    assert 'Missing Gross' not in _frame['party'].tolist()


def case_10_comma_decimal_amount() -> None:
    assert parse_amount('14,30,000.387') == 1430000.387
    rows = [_row('Comma Party', '14,30,000.387', voucher='C1')]
    # Below threshold alone — still verify conversion into frame
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['totalRecords'] == 1
    assert abs(float(_frame.iloc[0]['gross_amount']) - 1430000.387) < 1e-9
    # Force eligibility with additional amount
    rows2 = [
        _row('Comma Party', '14,30,000.387', voucher='C1', order=0),
        _row('Comma Party', '40,00,000', voucher='C2', order=1),
    ]
    _frame2, summary2, _d, metrics2 = build_tds_report_frames(rows2)
    expected = round(1430000.387 + 4000000.0, 2)
    assert summary2.iloc[0]['purchases_during_year'] == expected
    assert summary2.iloc[0]['tds_deductible'] == round(expected * TDS_RATE, 2)
    assert metrics2['eligibleSuppliers'] == 1


def case_11_large_dataset_100k() -> None:
    # 50 parties × 2000 vouchers = 100,000 rows
    # Parties 0..24 get 60L total each (eligible); 25..49 get 40L (not eligible)
    n_parties = 50
    vouchers_per_party = 2000
    rows: list[dict[str, Any]] = []
    order = 0
    for p in range(n_parties):
        party = f'Party-{p:03d}'
        per_voucher = 3000.0 if p < 25 else 2000.0  # 60L vs 40L
        for v in range(vouchers_per_party):
            rows.append(
                _row(
                    party,
                    per_voucher,
                    voucher=f'V{p}-{v}',
                    order=order,
                )
            )
            order += 1

    assert len(rows) == 100_000
    started = perf_counter()
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    elapsed = perf_counter() - started

    assert metrics['totalRecords'] == 100_000
    assert metrics['totalParties'] == 50
    assert metrics['eligibleSuppliers'] == 25
    assert metrics['nonEligibleSuppliers'] == 25
    assert abs(metrics['totalTdsDeductible'] - (25 * 6000.0)) < 0.01
    assert len(summary) == 25
    assert len(detailed) == 25 * 2000
    assert elapsed < 30.0, f'100k grouping took too long: {elapsed:.2f}s'


def case_12_none_eligible() -> None:
    rows = [
        _row('Low A', '10,00,000', voucher='1', order=0),
        _row('Low B', '20,00,000', voucher='2', order=1),
        _row('Low C', '30,00,000', voucher='3', order=2),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['eligibleSuppliers'] == 0
    assert metrics['totalTdsDeductible'] == 0.0
    assert metrics['compliancePercent'] == 0.0
    assert len(summary) == 0
    assert len(detailed) == 0


def case_13_all_eligible() -> None:
    rows = [
        _row('High A', '60,00,000', voucher='1', order=0),
        _row('High B', '70,00,000', voucher='2', order=1),
        _row('High C', '80,00,000', voucher='3', order=2),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert metrics['eligibleSuppliers'] == 3
    assert metrics['totalParties'] == 3
    assert metrics['compliancePercent'] == 100.0
    assert len(summary) == 3
    assert len(detailed) == 3


def case_dashboard_math() -> None:
    rows = [
        _row('A', '60,00,000', voucher='A1', order=0),
        _row('B', '35,00,000', voucher='B1', order=1),
        _row('C', '75,00,000', voucher='C1', order=2),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    response = build_tds_01_response(
        detailed_rows=detailed.to_dict(orient='records'),
        summary_rows=summary.to_dict(orient='records'),
        metrics=metrics,
    )
    s = response['summary']
    assert s['totalRecords'] == 3
    assert s['eligibleSuppliers'] == 2
    assert s['nonEligibleSuppliers'] == 1
    assert s['totalPurchaseAmount'] == 17000000.0
    assert s['totalTdsDeductible'] == 6000.0 + 7500.0
    assert s['compliancePercent'] == round((2 / 3) * 100, 2)
    # Widget identity with metrics
    assert s['eligibleSuppliers'] + s['nonEligibleSuppliers'] == s['totalParties']


def case_summary_sheet_no_duplicates() -> None:
    rows = [
        _row('Dup', '30,00,000', voucher='1', order=0),
        _row('Dup', '30,00,000', voucher='2', order=1),
        _row('Other', '10,00,000', voucher='3', order=2),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert summary['party'].is_unique
    assert list(summary.columns) == ['party', 'purchases_during_year', 'tds_deductible']
    assert summary.iloc[0]['purchases_during_year'] == 6000000.0
    assert summary.iloc[0]['tds_deductible'] == 6000.0


def case_detailed_sheet_complete() -> None:
    rows = [
        _row('Eligible', '20,00,000', voucher='E1', order=0),
        _row('Eligible', '40,00,000', voucher='E2', order=1),
        _row('Skip', '10,00,000', voucher='S1', order=2),
        _row('Eligible', '5,00,000', voucher='E3', order=3),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    assert list(detailed['voucher_no']) == ['E1', 'E2', 'E3']
    assert 'S1' not in detailed['voucher_no'].tolist()
    assert len(detailed) == 3


def case_excel_export_formatting() -> None:
    rows = [
        _row('Export Co', '20,00,000', voucher='X1', order=0, branch='Hyd', pan='ABCDE1234F'),
        _row('Export Co', '40,00,000', voucher='X2', order=1, branch='Hyd', pan='ABCDE1234F'),
    ]
    _frame, summary, detailed, metrics = build_tds_report_frames(rows)
    workbook = generate_tds_01_workbook(
        detailed_rows=detailed.to_dict(orient='records'),
        summary_rows=summary.to_dict(orient='records'),
    )
    assert workbook[:2] == b'PK'
    sheets = pd.read_excel(io.BytesIO(workbook), sheet_name=None)
    assert set(sheets.keys()) == {'Detailed', 'Summary'}
    detailed_df = sheets['Detailed']
    summary_df = sheets['Summary']
    assert list(detailed_df.columns) == list(DETAILED_HEADER_MAP.values())
    assert list(summary_df.columns) == list(SUMMARY_HEADER_MAP.values())
    assert len(detailed_df) == 2
    assert len(summary_df) == 1
    assert float(summary_df.iloc[0]['TDS Deductible']) == 6000.0


def case_excel_parser_and_required_columns() -> None:
    good = _excel_bytes([_row('Parser Co', '60,00,000', voucher='P1')])
    loaded = load_purchase_voucher_workbook(good)
    cols = set(c for c in loaded.dataframe.columns if not str(c).startswith('__') and c != 'source_excel_row_number')
    ok, missing = validate_required_columns(cols)
    assert ok, f'missing={missing}'

    # Missing Gross Amount column entirely
    buffer = io.BytesIO()
    pd.DataFrame(
        [{'Date': '01-04-2025', 'Voucher No': 'V1', 'Party': 'X'}]
    ).to_excel(buffer, index=False)
    bad = buffer.getvalue()
    try:
        load_purchase_voucher_workbook(bad)
        raise AssertionError('Expected HEADER_NOT_FOUND / missing Gross Amount')
    except SheetValidationError as exc:
        assert exc.code in {'HEADER_NOT_FOUND', 'MISSING_REQUIRED_COLUMNS'}


def case_processor_end_to_end() -> None:
    workbook = _excel_bytes(
        [
            _row('Proc A', '60,00,000', voucher='1', order=0),
            _row('Proc B', '20,00,000', voucher='2', order=1),
        ]
    )
    response = Tds01Processor().process(workbook)
    assert response['success'] is True
    assert response['fileType'] == 'tds_rate_01'
    assert response['summary']['eligibleSuppliers'] == 1
    assert response['summary']['totalTdsDeductible'] == 6000.0
    assert len(response['summaryRecords']) == 1
    assert len(response['detailedRecords']) == 1


def case_api_validate_and_export() -> None:
    client = TestClient(app)
    workbook = _excel_bytes(
        [
            _row('API A', '60,00,000', voucher='A1', order=0),
            _row('API B', '10,00,000', voucher='B1', order=1),
            _row('API C', '75,00,000', voucher='C1', order=2),
        ]
    )

    validate = client.post(
        '/api/v1/process/tds-rate-0.1/validate',
        files={
            'file': (
                'purchase_vouchers.xlsx',
                workbook,
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            )
        },
    )
    assert validate.status_code == 200, validate.text
    body = validate.json()
    assert body['success'] is True
    assert body['summary']['eligibleSuppliers'] == 2
    assert body['summary']['nonEligibleSuppliers'] == 1
    assert body['summary']['totalTdsDeductible'] == 6000.0 + 7500.0
    assert body['summary']['compliancePercent'] == round((2 / 3) * 100, 2)

    export = client.post(
        '/api/v1/process/tds-rate-0.1/export',
        json={
            'detailedRecords': body['detailedRecords'],
            'summaryRecords': body['summaryRecords'],
        },
    )
    assert export.status_code == 200, export.text
    assert 'TDS_0_1_Report.xlsx' in export.headers.get('content-disposition', '')
    assert export.content[:2] == b'PK'
    sheets = pd.read_excel(io.BytesIO(export.content), sheet_name=None)
    assert 'Detailed' in sheets and 'Summary' in sheets


def case_api_empty_file() -> None:
    client = TestClient(app)
    response = client.post(
        '/api/process/tds-rate-0.1',
        files={'file': ('empty.xlsx', b'', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
    )
    assert response.status_code == 400
    assert response.json()['success'] is False


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


CASES: list[tuple[str, Callable[[], None]]] = [
    ('TC01 Single supplier 60L - Eligible, TDS 6000', case_01_single_eligible_60l),
    ('TC02 Single supplier 49,99,999 - Not eligible', case_02_single_below_threshold),
    ('TC03 Multi voucher 20L+15L+18L - Eligible, TDS 5300', case_03_multi_voucher_53l),
    ('TC04 Exact 50L - NOT eligible (exclusive >)', case_04_exact_50l_not_eligible),
    ('TC05 Multiple suppliers - A and C eligible', case_05_multiple_suppliers),
    ('TC06 Duplicate supplier names grouped', case_06_duplicate_supplier_grouping),
    ('TC07 Party whitespace normalized to ABC', case_07_party_name_whitespace),
    ('TC08 Blank rows ignored', case_08_blank_rows_ignored),
    ('TC09 Missing Gross Amount skipped', case_09_missing_gross_amount_skipped),
    ('TC10 Comma / decimal amount parsing', case_10_comma_decimal_amount),
    ('TC11 Large dataset 100,000 rows', case_11_large_dataset_100k),
    ('TC12 No supplier above threshold', case_12_none_eligible),
    ('TC13 Every supplier above threshold (100% compliance)', case_13_all_eligible),
    ('Dashboard widgets mathematical consistency', case_dashboard_math),
    ('Summary sheet one row per supplier / no duplicates', case_summary_sheet_no_duplicates),
    ('Detailed sheet includes all eligible vouchers', case_detailed_sheet_complete),
    ('Excel export Detailed + Summary formatting', case_excel_export_formatting),
    ('Excel parser + required column validation', case_excel_parser_and_required_columns),
    ('Processor end-to-end (workbook to API response)', case_processor_end_to_end),
    ('API validate + export endpoints', case_api_validate_and_export),
    ('API empty file returns 400', case_api_empty_file),
]


def main() -> int:
    import sys

    # Avoid Windows cp1252 crashes on report characters
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    print('=' * 72)
    print('TDS @ 0.1% AUDIT - CONTROLLED VALIDATION REPORT')
    print('=' * 72)
    print()

    for name, fn in CASES:
        run_case(name, fn)

    passed = sum(1 for r in RESULTS if r.status == 'PASS')
    failed = sum(1 for r in RESULTS if r.status == 'FAIL')

    for result in RESULTS:
        mark = 'PASS' if result.status == 'PASS' else 'FAIL'
        print(f'[{mark}] {result.name}  ({result.elapsed_ms:.1f} ms)')
        if result.status == 'FAIL':
            print(f'       Test Name     : {result.name}')
            print(f'       Root Cause    : {result.root_cause}')
            print(f'       Location      : {result.location or "n/a"}')
            print(f'       Suggested Fix : {result.suggested_fix}')
            if result.detail and result.detail != result.root_cause:
                print(f'       Detail        : {result.detail}')

    print()
    print('-' * 72)
    print(f'Total: {len(RESULTS)}  |  PASS: {passed}  |  FAIL: {failed}')
    print('-' * 72)

    if failed == 0:
        print()
        print('TDS Audit Engine Validation Completed Successfully.')
        print()
        return 0

    print()
    print('TDS Audit Engine Validation FAILED. See FAIL cases above.')
    print('No audit logic was modified.')
    print()
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

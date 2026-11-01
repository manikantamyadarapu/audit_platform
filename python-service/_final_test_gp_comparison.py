"""Gross Profit comparison across Closing Stock workbooks with different layouts."""

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook, load_workbook

from app.engines.financials_engine.engine.gp_comparison import compare_gross_profit_workbooks
from app.main import app

client = TestClient(app)


def _save(workbook: Workbook) -> bytes:
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _reference_workbook() -> bytes:
    """Manual layout: GP at columns 25-26, abbreviated sheet names, repeated titles."""
    workbook = Workbook()
    diamonds = workbook.active
    diamonds.title = 'DIA'
    diamonds['A1'] = 'Shree Jewellers'
    diamonds['A2'] = 'Basheerbagh Branch'
    diamonds['A4'] = 'DETAILS OF JEWELS CLOSING STOCK - DIAMONDS'
    diamonds['A5'] = 'Particulars'
    diamonds['B5'] = 'Sales'
    diamonds['Y5'] = 'Gross Profit'
    diamonds['AA5'] = 'GP AY 2025-26'
    diamonds['A6'] = 1
    diamonds['B6'] = '14  (Amt.)'
    diamonds['Y6'] = ' (Amt.)'
    diamonds['Z6'] = '%'
    diamonds['B8'] = 111
    diamonds['A7'] = 'Uncut - diamonds'
    diamonds['A8'] = 'Polki'
    diamonds['Y8'] = 10
    diamonds['Z8'] = 0.5
    diamonds['A10'] = 'Chakri'
    diamonds['Y10'] = 20
    diamonds['Z10'] = 0.25
    diamonds['A11'] = 'TOTAL'
    diamonds['Y11'] = 30
    diamonds['Z11'] = 0.3
    diamonds['A13'] = 'Flat Polki'
    diamonds['A14'] = 'Chakri'
    diamonds['Y14'] = 5
    diamonds['Z14'] = 0.1
    diamonds['A15'] = 'TOTAL - FLAT POLKI'
    diamonds['Y15'] = 5
    diamonds['Z15'] = 0.1
    diamonds['A17'] = 'GRAND TOTAL'
    diamonds['Y17'] = 35
    diamonds['Z17'] = 0.2
    diamonds['A19'] = 'Shree Jewellers'
    diamonds['A20'] = 'Particulars'
    diamonds['A21'] = 1
    diamonds['A22'] = 'Beads'
    diamonds['A23'] = 'Di. Beads'
    diamonds['Y23'] = 7
    diamonds['Z23'] = 0.4
    diamonds['A24'] = 'TOTAL'
    diamonds['Y24'] = 7
    diamonds['Z24'] = 0.4
    diamonds['A26'] = 'TOTAL'
    diamonds['A28'] = 'Only Reference'
    diamonds['Y28'] = 3
    diamonds['Z28'] = 0.03
    diamonds['A29'] = 'Mix'
    diamonds['Y29'] = 1
    diamonds['Z29'] = 0.01
    diamonds['A30'] = 'Mix'
    diamonds['Y30'] = 2
    diamonds['Z30'] = 0.02

    trading = workbook.create_sheet('trading')
    trading['A5'] = 'Particulars'
    trading['B5'] = 'Gross Profit'
    trading['B6'] = 'Amt.'
    trading['C6'] = '%'
    trading['A7'] = 'Should Not Compare'
    trading['B7'] = 999
    trading['C7'] = 0.99

    emeralds = workbook.create_sheet('EME')
    emeralds['A1'] = 'Particulars'
    emeralds['C1'] = 'Gross Profit'
    emeralds['C2'] = 'Amt.'
    emeralds['D2'] = '%'
    emeralds['A3'] = 'Emeralds'
    emeralds['A4'] = 'JEM 100'
    emeralds['C4'] = 8
    emeralds['D4'] = 0.08
    emeralds['A5'] = 'Total'
    emeralds['C5'] = 8
    emeralds['D5'] = 0.08

    pearls = workbook.create_sheet('PERALS')
    pearls['A1'] = 'Particulars'
    pearls['B1'] = 'Gross Profit'
    pearls['A2'] = '1'
    pearls['B2'] = 'Amt.'
    pearls['C2'] = '%'
    pearls['A4'] = 'Pearls :'
    pearls['A5'] = 'JPS 100'
    pearls['B5'] = 4
    pearls['C5'] = 0.04
    pearls['A6'] = 'TOTAL'
    pearls['B6'] = 4
    pearls['C6'] = 0.04
    return _save(workbook)


def _generated_workbook() -> bytes:
    """Generated layout: GP further right, full sheet names, different row order."""
    workbook = Workbook()
    diamonds = workbook.active
    diamonds.title = 'Diamond'
    diamonds['A1'] = 'Company Name'
    diamonds['A4'] = 'DETAILS OF JEWELS CLOSING STOCK - DIAMOND'
    diamonds['A6'] = 'Particulars / Product'
    diamonds['B6'] = 'Sales'
    diamonds['H6'] = 'Gross Profit'
    diamonds['B8'] = 'Amt.'
    diamonds['H8'] = 'Amt.'
    diamonds['I8'] = '%'
    diamonds['I8'].number_format = '0.00%'
    for index, column in enumerate(('B', 'H', 'I'), start=1):
        diamonds[f'{column}9'] = index
    diamonds['B12'] = 12345
    diamonds['A11'] = 'Uncut - Diamonds'
    diamonds['A12'] = 'Chakri'
    diamonds['H12'] = 20.00000001
    diamonds['I12'] = 0.25
    diamonds['A14'] = 'Polki'
    diamonds['H14'] = 99
    diamonds['I14'] = 0.5
    diamonds['A15'] = 'TOTAL'
    diamonds['H15'] = 30
    diamonds['I15'] = 0.3
    diamonds['A17'] = 'Flat Polki'
    diamonds['A18'] = 'Chakri'
    diamonds['H18'] = 5
    diamonds['I18'] = 0.1
    diamonds['A19'] = 'TOTAL'
    diamonds['H19'] = 9
    diamonds['I19'] = 0.1
    diamonds['A21'] = 'GRAND TOTAL'
    diamonds['H21'] = 35
    diamonds['I21'] = 0.2
    diamonds['A23'] = 'Beads'
    diamonds['A24'] = 'Di. Beads'
    diamonds['H24'] = 7
    diamonds['I24'] = 0.25
    diamonds['A25'] = 'TOTAL'
    diamonds['H25'] = 7
    diamonds['I25'] = 0.4
    diamonds['A27'] = 'Only Generated'
    diamonds['H27'] = 6
    diamonds['I27'] = 0.06

    trading = workbook.create_sheet('Trading')
    trading['A6'] = 'Particulars / Product'
    trading['B6'] = 'Gross Profit'
    trading['B8'] = 'Amt.'
    trading['C8'] = '%'
    trading['A10'] = 'Should Not Compare'
    trading['B10'] = 1
    trading['C10'] = 0.01

    emeralds = workbook.create_sheet('Emerald')
    emeralds['A1'] = 'Particulars / Product'
    emeralds['E1'] = 'Gross Profit'
    emeralds['E2'] = 'Amt.'
    emeralds['F2'] = '%'
    emeralds['A3'] = 'Emeralds'
    emeralds['A4'] = 'JEM 100'
    emeralds['E4'] = 8
    emeralds['F4'] = 0.08
    emeralds['A5'] = 'TOTAL'
    emeralds['E5'] = 8
    emeralds['F5'] = 0.08

    workbook.create_sheet('Abstract')
    return _save(workbook)


def _report():
    return compare_gross_profit_workbooks(
        _generated_workbook(),
        _reference_workbook(),
        generated_name='generated.xlsx',
        reference_name='bb.xlsx',
    )


def _product(report, sheet, product, category):
    matches = [
        row for row in report['rows']
        if row['sheet'] == sheet and row['product'] == product and row['category'] == category
    ]
    assert len(matches) == 1
    return matches[0]


def test_layouts_row_order_and_blanks_match_by_name_and_section():
    report = _report()
    chakri = _product(report, 'Diamond', 'Chakri', 'Uncut - Diamonds')
    assert chakri['status'] == 'PASS'
    assert chakri['amountStatus'] == 'PASS'
    assert chakri['percentStatus'] == 'PASS'
    assert chakri['generatedGpAmount'] == 20.00000001
    assert chakri['referenceGpAmount'] == 20
    flat = _product(report, 'Diamond', 'Chakri', 'Flat Polki')
    assert flat['status'] == 'PASS'
    assert flat['generatedGpAmount'] == 5
    assert flat['referenceGpAmount'] == 5
    assert chakri is not flat


def test_amount_and_percent_are_compared_independently():
    report = _report()
    polki = _product(report, 'Diamond', 'Polki', 'Uncut - Diamonds')
    assert polki['amountStatus'] == 'FAIL'
    assert polki['percentStatus'] == 'PASS'
    assert polki['status'] == 'FAIL'
    assert polki['amountDifference'] == 89
    assert polki['percentagePointDifference'] == 0

    beads = _product(report, 'Diamond', 'Di. Beads', 'Beads')
    assert beads['amountStatus'] == 'PASS'
    assert beads['percentStatus'] == 'FAIL'
    assert beads['generatedGpPercent'] == 0.25
    assert beads['referenceGpPercent'] == 0.4
    assert beads['percentagePointDifference'] == pytest.approx(-15)


def test_totals_are_separate_from_products_and_trading_is_excluded():
    report = _report()
    product_names = {row['product'] for row in report['rows']}
    assert 'TOTAL' not in product_names
    assert 'GRAND TOTAL' not in product_names
    assert 'Should Not Compare' not in product_names
    assert 'Trading' not in {row['sheet'] for row in report['rows']}
    assert report['excludedSheets'] == ['Trading', 'Abstract']

    diamond = next(sheet for sheet in report['sheets'] if sheet['sheet'] == 'Diamond')
    kinds = {row['rowKind'] for row in diamond['totals']}
    assert kinds == {'category_total', 'overall_total'}
    uncut_total = next(
        row for row in diamond['totals']
        if row['rowKind'] == 'category_total' and row['category'] == 'Uncut - Diamonds'
    )
    assert uncut_total['status'] == 'PASS'
    assert uncut_total['generatedGpAmount'] == 30
    flat_total = next(
        row for row in diamond['totals']
        if row['rowKind'] == 'category_total' and row['category'] == 'Flat Polki'
    )
    assert flat_total['status'] == 'FAIL'
    assert flat_total['amountDifference'] == 4
    grand = next(row for row in diamond['totals'] if row['rowKind'] == 'overall_total')
    assert grand['status'] == 'PASS'
    assert grand['product'] == 'GRAND TOTAL'


def test_missing_products_duplicates_and_missing_sheet_are_reported():
    report = _report()
    missing = {(row['product'], row['status']) for row in report['missingProducts']}
    assert ('Only Generated', 'MISSING_IN_REFERENCE') in missing
    assert ('Only Reference', 'MISSING_IN_GENERATED') in missing

    duplicates = [row for row in report['duplicateProducts'] if row['product'] == 'Mix']
    assert len(duplicates) == 2
    assert {row['source'] for row in duplicates} == {'reference'}
    assert not any(row['product'] == 'Mix' for row in report['rows'])

    diamond = next(sheet for sheet in report['sheets'] if sheet['sheet'] == 'Diamond')
    assert diamond['matchedProducts'] == 4
    assert diamond['amountMismatches'] == 1
    assert diamond['percentageMismatches'] == 1
    assert diamond['missingProducts'] == 2

    pearls = next(sheet for sheet in report['sheets'] if sheet['sheet'] == 'Pearls')
    assert pearls['missingSheet'] == 'generated'
    assert pearls['missingProducts'] == 1
    assert pearls['status'] == 'FAIL'
    pearl_row = next(row for row in report['missingProducts'] if row['product'] == 'JPS 100')
    assert pearl_row['status'] == 'MISSING_IN_GENERATED'
    assert pearl_row['referenceGpAmount'] == 4


def test_sheet_aliases_match_and_tolerances_are_configurable():
    report = _report()
    emerald = _product(report, 'Emerald', 'JEM 100', 'Emeralds')
    assert emerald['status'] == 'PASS'
    emerald_sheet = next(sheet for sheet in report['sheets'] if sheet['sheet'] == 'Emerald')
    assert emerald_sheet['generatedSheet'] == 'Emerald'
    assert emerald_sheet['referenceSheet'] == 'EME'
    assert emerald_sheet['status'] == 'PASS'

    loose = compare_gross_profit_workbooks(
        _generated_workbook(),
        _reference_workbook(),
        amount_tolerance=100,
        percent_tolerance=1,
    )
    polki = _product(loose, 'Diamond', 'Polki', 'Uncut - Diamonds')
    beads = _product(loose, 'Diamond', 'Di. Beads', 'Beads')
    assert polki['status'] == 'PASS'
    assert beads['status'] == 'PASS'


def test_section_prefix_and_spaced_codes_match_the_short_reference_name():
    generated = Workbook()
    pearls = generated.active
    pearls.title = 'Pearls'
    pearls['A1'] = 'Particulars / Product'
    pearls['B1'] = 'Gross Profit'
    pearls['B2'] = 'Amt.'
    pearls['C2'] = '%'
    pearls['A4'] = 'Pearls JPS 100'
    pearls['B4'] = 4
    pearls['C4'] = 0.04
    pearls['A5'] = 'GRAND TOTAL'
    pearls['B5'] = 4
    pearls['C5'] = 0.04
    diamonds = generated.create_sheet('Diamond')
    diamonds['A1'] = 'Particulars / Product'
    diamonds['B1'] = 'Gross Profit'
    diamonds['B2'] = 'Amt.'
    diamonds['C2'] = '%'
    diamonds['A4'] = 'Diamonds - Flat Polki'
    diamonds['A5'] = 'Flat Polki FP 1'
    diamonds['B5'] = 12
    diamonds['C5'] = 0.12
    diamonds['A6'] = 'TOTAL'
    diamonds['B6'] = 12
    diamonds['C6'] = 0.12
    emeralds = generated.create_sheet('Emerald')
    emeralds['A1'] = 'Particulars / Product'
    emeralds['B1'] = 'Gross Profit'
    emeralds['B2'] = 'Amt.'
    emeralds['C2'] = '%'
    emeralds['A3'] = 'Emeralds JEM 100'
    emeralds['B3'] = 8
    emeralds['C3'] = 0.08

    reference = Workbook()
    pearls_ref = reference.active
    pearls_ref.title = 'PERALS'
    pearls_ref['A1'] = 'Particulars'
    pearls_ref['B1'] = 'Gross Profit'
    pearls_ref['B2'] = ' (Amt.)'
    pearls_ref['C2'] = '%'
    pearls_ref['A4'] = 'Pearls :'
    pearls_ref['A5'] = 'JPS 100'
    pearls_ref['B5'] = 4
    pearls_ref['C5'] = 0.04
    pearls_ref['A6'] = 'TOTAL'
    pearls_ref['B6'] = 4
    pearls_ref['C6'] = 0.04
    diamonds_ref = reference.create_sheet('DIA')
    diamonds_ref['A1'] = 'Particulars'
    diamonds_ref['B1'] = 'Gross Profit'
    diamonds_ref['B2'] = 'Amt.'
    diamonds_ref['C2'] = '%'
    diamonds_ref['A4'] = 'Diamonds - Flat polki'
    diamonds_ref['A5'] = 'FP1'
    diamonds_ref['B5'] = 12
    diamonds_ref['C5'] = 0.12
    diamonds_ref['A6'] = 'TOTAL'
    diamonds_ref['B6'] = 12
    diamonds_ref['C6'] = 0.12
    emeralds_ref = reference.create_sheet('EME')
    emeralds_ref['A1'] = 'Particulars'
    emeralds_ref['C1'] = 'Gross Profit'
    emeralds_ref['C2'] = 'Amt.'
    emeralds_ref['D2'] = '%'
    emeralds_ref['A3'] = 'Emeralds'
    emeralds_ref['A4'] = 'JEM 100'
    emeralds_ref['C4'] = 8
    emeralds_ref['D4'] = 0.08

    report = compare_gross_profit_workbooks(_save(generated), _save(reference))
    assert _product(report, 'Pearls', 'Pearls JPS 100', 'Pearls')['status'] == 'PASS'
    assert _product(report, 'Diamond', 'Flat Polki FP 1', 'Diamonds - Flat Polki')['status'] == 'PASS'
    assert _product(report, 'Emerald', 'Emeralds JEM 100', 'Emerald')['status'] == 'PASS'
    assert report['missingProducts'] == []
    pearl_sheet = next(sheet for sheet in report['sheets'] if sheet['sheet'] == 'Pearls')
    assert len(pearl_sheet['totals']) == 1
    assert pearl_sheet['totals'][0]['status'] == 'PASS'


def test_comparison_does_not_modify_either_workbook():
    generated = _generated_workbook()
    reference = _reference_workbook()
    compare_gross_profit_workbooks(generated, reference)
    assert load_workbook(BytesIO(generated))['Diamond']['H12'].value == 20.00000001
    assert load_workbook(BytesIO(reference))['DIA']['Y8'].value == 10
    assert load_workbook(BytesIO(generated)).sheetnames == [
        'Diamond', 'Trading', 'Emerald', 'Abstract',
    ]


def test_compare_endpoint_returns_the_report():
    response = client.post(
        '/api/v1/process/financials/compare-gross-profit',
        files={
            'generated': ('generated.xlsx', _generated_workbook(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
            'reference': ('bb.xlsx', _reference_workbook(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        },
        data={'amountTolerance': '0.0001', 'percentTolerance': '0.000001'},
    )
    assert response.status_code == 200
    body = response.json()
    assert body['generatedWorkbook'] == 'generated.xlsx'
    assert body['referenceWorkbook'] == 'bb.xlsx'
    assert any(row['product'] == 'Polki' and row['status'] == 'FAIL' for row in body['rows'])

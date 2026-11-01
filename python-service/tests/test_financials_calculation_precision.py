"""Financials keep full calculation precision; rounding is display-only."""

from decimal import Decimal
from io import BytesIO

from openpyxl import load_workbook

from app.engines.financials_engine.config.product_rule_book import (
    _add_average_rate,
    _add_closing_stock,
    _add_gross_profit,
    _add_gross_profit_pct,
    _add_issues_amounts,
    _add_stock_section_totals,
)
from app.engines.financials_engine.engine.amount_rounding import round_amount_whole
from app.engines.financials_engine.engine.closing_stock_template import (
    build_closing_stock_template_bytes,
    displayed_average_rate,
    leaf_index_for_measure,
)
from app.engines.financials_engine.engine.financials_export import prepare_branch_export_layout
from app.engines.financials_engine.engine.jubilee_hills_template import (
    build_jubilee_hills_workbook_bytes,
)
from app.engines.financials_engine.engine.receipt_amounts import apply_source_receipt_amounts
from tests.test_receipt_amounts import _layout, _product


RAW_RATE = float(Decimal('100') / Decimal('13'))


def _excel_value(wb, label, measure):
    ws = wb['Diamond']
    col = 2 + leaf_index_for_measure(measure)
    for row in range(10, (ws.max_row or 9) + 1):
        if ws.cell(row=row, column=1).value == label:
            return ws.cell(row=row, column=col).value
    raise AssertionError(f'{label} not found')


def test_average_rate_keeps_full_precision():
    filled = _add_average_rate({'totalQty': 13, 'totalAmt': 100})
    assert filled['averageRateAmt'] == RAW_RATE
    assert displayed_average_rate(filled['averageRateAmt']) == 8


def test_issue_amount_uses_raw_average_rate_not_displayed_rate():
    filled = _add_issues_amounts(
        {
            'totalQty': 13,
            'totalAmt': 100,
            'averageRateAmt': RAW_RATE,
            'issuesInternalQty': None,
            'issuesBanjaraHillsQty': 13,
            'issuesKokapetQty': 0,
        }
    )
    assert filled['issuesBanjaraHillsAmt'] == 100
    assert filled['issuesKokapetAmt'] == 0
    assert displayed_average_rate(RAW_RATE) * 13 == 104
    assert filled['issuesBanjaraHillsAmt'] != displayed_average_rate(RAW_RATE) * 13


def test_closing_receipt_and_gp_use_full_precision():
    raw = _add_stock_section_totals(
        {
            'openingQty': 13,
            'openingAmt': 100,
            'purchasesQty': 0,
            'purchasesAmt': 0,
            'salesQty': 0,
            'salesAmt': 50,
            'receiptsQty': None,
            'issuesInternalQty': None,
            'issuesBanjaraHillsQty': 13,
            'issuesKokapetQty': None,
        }
    )
    assert raw['averageRateAmt'] == RAW_RATE
    assert raw['issuesBanjaraHillsAmt'] == 100
    assert raw['closingStockQty'] == 0
    assert raw['closingStockAmt'] == 0
    gp = _add_gross_profit_pct(_add_gross_profit(raw))
    assert gp['grossProfitAmt'] == 50
    assert gp['grossProfitPct'] == float(Decimal('50') / Decimal('50'))

    rounded_issue_gp = 0 + 50 + 104 - 100
    assert gp['grossProfitAmt'] != rounded_issue_gp

    closing = _add_closing_stock(
        {
            'totalQty': 13,
            'totalAmt': 100,
            'salesQty': 0,
            'averageRateAmt': RAW_RATE,
            'issuesInternalQty': 0,
            'issuesBanjaraHillsQty': 0,
            'issuesKokapetQty': 0,
        }
    )
    assert closing['closingStockAmt'] == 100


def test_receipt_amount_uses_full_precision_source_rate():
    dest = _layout(
        'Di. RA 10',
        openingQty=1,
        openingAmt=1,
        purchasesQty=0,
        purchasesAmt=0,
        salesQty=0,
        salesAmt=0,
        receiptsJubileeHillsQty=13,
    )
    filled = apply_source_receipt_amounts(
        dest,
        destination='basheerbagh',
        source_average_rates={'jubileeHills': [{'product': 'Di. RA 10', 'averageRateAmt': RAW_RATE}]},
    )
    row = _product(filled['layoutByCategory'])
    assert row['receiptsJubileeHillsAmt'] == 100
    assert row['receiptsJubileeHillsAmt'] != displayed_average_rate(RAW_RATE) * 13


def test_all_three_branches_issue_from_raw_rate_and_excel_matches_preview():
    branches = (
        ('basheerbagh', build_closing_stock_template_bytes),
        ('kokapet', build_closing_stock_template_bytes),
        ('jubileeHills', lambda **kwargs: build_jubilee_hills_workbook_bytes(
            layout_by_category=kwargs['layout_by_category']
        )),
    )
    for destination, workbook in branches:
        dest = _layout(
            'Di. RA 10',
            openingQty=13,
            openingAmt=100,
            purchasesQty=0,
            purchasesAmt=0,
            salesQty=0,
            salesAmt=0,
            issuesBanjaraHillsQty=13,
        )
        prepared = prepare_branch_export_layout(
            destination=destination,
            layout_by_category=dest,
        )
        row = _product(prepared['layoutByCategory'])
        assert row['averageRateAmt'] == RAW_RATE, destination
        assert displayed_average_rate(row['averageRateAmt']) == 8
        assert row['issuesBanjaraHillsAmt'] == 100, destination
        assert round_amount_whole(row['issuesBanjaraHillsAmt']) == 100

        raw = workbook(
            products_by_category={'Diamond': ['Di. RA 10']},
            layout_by_category=prepared['layoutByCategory'],
        )
        wb = load_workbook(BytesIO(raw))
        assert _excel_value(wb, 'Di. RA 10', 'averageRateAmt') == 8
        assert _excel_value(wb, 'Di. RA 10', 'issuesBanjaraHillsAmt') == 100
        assert _excel_value(wb, 'Di. RA 10', 'issuesBanjaraHillsAmt') != 104
        assert _excel_value(wb, 'Di. RA 10', 'totalAmt') == round_amount_whole(row['totalAmt'])
        assert _excel_value(wb, 'Di. RA 10', 'closingStockAmt') == round_amount_whole(
            row['closingStockAmt']
        )

"""Preview layout and Excel export share the same finalize pipeline."""

from io import BytesIO

from openpyxl import load_workbook

from app.engines.financials_engine.engine.closing_stock_template import (
    build_closing_stock_template_bytes,
    leaf_index_for_measure,
)
from app.engines.financials_engine.engine.financials_export import prepare_branch_export_layout
from app.engines.financials_engine.engine.jubilee_hills_template import (
    build_jubilee_hills_workbook_bytes,
)
from app.engines.financials_engine.engine.receipt_amounts import ISSUE_RECEIPT_DROPS
from tests.test_receipt_amounts import _layout, _product


def _excel_col(measure: str) -> int:
    return 2 + leaf_index_for_measure(measure)


def _product_cell(wb, sheet: str, label: str, measure: str):
    ws = wb[sheet]
    col = _excel_col(measure)
    for row in range(10, (ws.max_row or 9) + 1):
        if ws.cell(row=row, column=1).value == label:
            return ws.cell(row=row, column=col).value
    raise AssertionError(f'{label} not found on {sheet}')


def test_phase2_issue_receipt_drops_are_unchanged():
    assert (
        'basheerbagh',
        'issuesBanjaraHillsQty',
        'issuesBanjaraHillsAmt',
        'jubileeHills',
        'receiptsJubileeHillsQty',
        'receiptsJubileeHillsAmt',
    ) in ISSUE_RECEIPT_DROPS
    assert (
        'basheerbagh',
        'issuesKokapetQty',
        'issuesKokapetAmt',
        'kokapet',
        'receiptsKokapetQty',
        'receiptsKokapetAmt',
    ) in ISSUE_RECEIPT_DROPS
    assert (
        'basheerbagh',
        'issuesInternalQty',
        'issuesInternalAmt',
        'basheerbagh',
        'receiptsInternalQty',
        'receiptsInternalAmt',
    ) in ISSUE_RECEIPT_DROPS
    assert (
        'kokapet',
        'issuesInternalQty',
        'issuesInternalAmt',
        'basheerbagh',
        'receiptsKokapetQty',
        'receiptsKokapetAmt',
    ) not in ISSUE_RECEIPT_DROPS


def test_preview_and_excel_match_for_all_three_branches():
    cases = [
        (
            'basheerbagh',
            'jubileeHills',
            'issuesBanjaraHillsQty',
            'receiptsJubileeHillsQty',
            'receiptsJubileeHillsAmt',
        ),
        (
            'kokapet',
            'basheerbagh',
            'issuesKokapetQty',
            'receiptsKokapetQty',
            'receiptsKokapetAmt',
        ),
        (
            'jubileeHills',
            'basheerbagh',
            'issuesBanjaraHillsQty',
            'receiptsJubileeHillsQty',
            'receiptsJubileeHillsAmt',
        ),
    ]
    for dest, source, issue_key, qty_key, amt_key in cases:
        dest_layout = _layout(
            'Di. RA 10',
            openingQty=4,
            openingAmt=40,
            purchasesQty=0,
            purchasesAmt=0,
            salesQty=0,
            salesAmt=0,
            **{qty_key: 1},
        )
        source_layout = _layout('Di. RA 10', **{issue_key: 6})
        prepared = prepare_branch_export_layout(
            destination=dest,
            layout_by_category=dest_layout,
            source_issue_layouts={source: source_layout},
            source_opening_complete={source: True},
            source_average_rates={source: [{'product': 'Di. RA 10', 'averageRateAmt': 5}]},
        )
        preview = _product(prepared['layoutByCategory'])
        assert preview[qty_key] == 6, dest
        assert preview[amt_key] == 30, dest

        if dest == 'jubileeHills':
            raw = build_jubilee_hills_workbook_bytes(
                layout_by_category=prepared['layoutByCategory']
            )
        else:
            raw = build_closing_stock_template_bytes(
                products_by_category=prepared['productsByCategory'],
                layout_by_category=prepared['layoutByCategory'],
            )
        wb = load_workbook(BytesIO(raw))
        assert _product_cell(wb, 'Diamond', 'Di. RA 10', qty_key) == 6
        assert _product_cell(wb, 'Diamond', 'Di. RA 10', amt_key) == 30


def test_export_internal_stays_on_same_branch():
    dest = _layout('Di. RA 10', receiptsInternalQty=1)
    source = _layout('Di. RA 10', issuesInternalQty=9)
    prepared = prepare_branch_export_layout(
        destination='kokapet',
        layout_by_category=dest,
        source_issue_layouts={'kokapet': source},
        source_opening_complete={'kokapet': True},
        source_average_rates={'kokapet': [{'product': 'Di. RA 10', 'averageRateAmt': 2}]},
    )
    row = _product(prepared['layoutByCategory'])
    assert row['receiptsInternalQty'] == 9
    assert row['receiptsKokapetQty'] in (None, 0)


def test_source_wise_receipts_keep_separate_qty_and_amount():
    dest = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        purchasesQty=0,
        purchasesAmt=0,
        salesQty=0,
        salesAmt=0,
    )
    prepared = prepare_branch_export_layout(
        destination='jubileeHills',
        layout_by_category=dest,
        source_issue_layouts={
            'basheerbagh': _layout('Di. RA 10', issuesBanjaraHillsQty=3),
            'kokapet': _layout('Di. RA 10', issuesBanjaraHillsQty=4),
        },
        source_opening_complete={'basheerbagh': True, 'kokapet': True},
        source_average_rates={
            'basheerbagh': [{'product': 'Di. RA 10', 'averageRateAmt': 10}],
            'kokapet': [{'product': 'Di. RA 10', 'averageRateAmt': 2}],
        },
    )
    row = _product(prepared['layoutByCategory'])
    assert row['receiptsJubileeHillsQty'] == 3
    assert row['receiptsJubileeHillsAmt'] == 30
    assert row['receiptsKokapetQty'] == 4
    assert row['receiptsKokapetAmt'] == 8
    assert row['receiptsQty'] == 7
    assert row['receiptsAmt'] == 38

    raw = build_jubilee_hills_workbook_bytes(layout_by_category=prepared['layoutByCategory'])
    wb = load_workbook(BytesIO(raw))
    assert _product_cell(wb, 'Diamond', 'Di. RA 10', 'receiptsJubileeHillsQty') == 3
    assert _product_cell(wb, 'Diamond', 'Di. RA 10', 'receiptsJubileeHillsAmt') == 30
    assert _product_cell(wb, 'Diamond', 'Di. RA 10', 'receiptsKokapetQty') == 4
    assert _product_cell(wb, 'Diamond', 'Di. RA 10', 'receiptsKokapetAmt') == 8
    assert _product_cell(wb, 'Diamond', 'Di. RA 10', 'receiptsQty') == 7
    assert _product_cell(wb, 'Diamond', 'Di. RA 10', 'receiptsAmt') == 38

    from app.engines.financials_engine.engine.closing_stock_template import displayed_average_rate

    preview_avg = row['averageRateAmt']
    excel_avg = _product_cell(wb, 'Diamond', 'Di. RA 10', 'averageRateAmt')
    assert excel_avg == displayed_average_rate(preview_avg)

    ws = wb['Diamond']
    internal_col = _excel_col('receiptsInternalQty')
    for excel_row in range(10, (ws.max_row or 9) + 1):
        if ws.cell(row=excel_row, column=1).value in {'TOTAL', 'GRAND TOTAL'}:
            value = ws.cell(row=excel_row, column=internal_col).value
            assert value in (None, '')
            assert not (isinstance(value, str) and value.startswith('='))


def test_repeated_export_keeps_source_wise_receipts():
    dest = _layout('Di. RA 10')
    sources = {
        'basheerbagh': _layout('Di. RA 10', issuesBanjaraHillsQty=3),
        'kokapet': _layout('Di. RA 10', issuesBanjaraHillsQty=4),
    }
    first = prepare_branch_export_layout(
        destination='jubileeHills',
        layout_by_category=dest,
        source_issue_layouts=sources,
        source_opening_complete={'basheerbagh': True, 'kokapet': True},
        source_average_rates={
            'basheerbagh': [{'product': 'Di. RA 10', 'averageRateAmt': 10}],
            'kokapet': [{'product': 'Di. RA 10', 'averageRateAmt': 2}],
        },
    )
    second = prepare_branch_export_layout(
        destination='jubileeHills',
        layout_by_category=first['layoutByCategory'],
        source_issue_layouts=sources,
        source_opening_complete={'basheerbagh': True, 'kokapet': True},
        source_average_rates={
            'basheerbagh': [{'product': 'Di. RA 10', 'averageRateAmt': 10}],
            'kokapet': [{'product': 'Di. RA 10', 'averageRateAmt': 2}],
        },
    )
    only_bh = prepare_branch_export_layout(
        destination='jubileeHills',
        layout_by_category=first['layoutByCategory'],
        source_issue_layouts={'basheerbagh': sources['basheerbagh']},
        source_opening_complete={'basheerbagh': True},
        source_average_rates={'basheerbagh': [{'product': 'Di. RA 10', 'averageRateAmt': 10}]},
    )
    first_row = _product(first['layoutByCategory'])
    second_row = _product(second['layoutByCategory'])
    only_row = _product(only_bh['layoutByCategory'])
    assert first_row['receiptsJubileeHillsQty'] == second_row['receiptsJubileeHillsQty'] == 3
    assert first_row['receiptsKokapetQty'] == second_row['receiptsKokapetQty'] == 4
    assert first_row['receiptsAmt'] == second_row['receiptsAmt'] == 38
    assert only_row['receiptsJubileeHillsQty'] == 3
    assert only_row['receiptsKokapetQty'] == 4


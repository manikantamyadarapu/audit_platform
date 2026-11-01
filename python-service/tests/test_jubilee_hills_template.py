"""Jubilee Hills blank Financials workbook keeps structure and omits values."""

from io import BytesIO

from openpyxl import load_workbook

from app.engines.financials_engine.engine.closing_stock_template import CLOSING_STOCK_CATEGORIES
from app.engines.financials_engine.engine.jubilee_hills_template import (
    build_jubilee_hills_structure_bytes,
    build_jubilee_hills_workbook_bytes,
)


def test_jubilee_hills_workbook_is_structure_only():
    raw = build_jubilee_hills_structure_bytes(
        company_name='Eximp',
        address='Jubilee Hills',
        financial_year='AY 2025-26',
    )
    wb = load_workbook(BytesIO(raw))
    assert wb.sheetnames == [
        *CLOSING_STOCK_CATEGORIES,
        'Trading',
        'Abstract',
    ]

    diamond = wb['Diamond']
    assert diamond['A1'].value == 'Eximp'
    assert diamond['A4'].value == 'DETAILS OF JEWELS CLOSING STOCK - DIAMOND'
    assert diamond['A6'].value == 'Particulars / Product'
    assert diamond.cell(row=7, column=6).value == 'Internal Stock Transfer'
    assert diamond.cell(row=7, column=8).value == 'Basheerbagh'
    assert diamond.cell(row=7, column=10).value == 'Kokapet'
    assert diamond.cell(row=7, column=17).value == 'Internal Stock Transfer'
    assert diamond.cell(row=7, column=19).value == 'Basheerbagh'
    assert diamond.cell(row=7, column=21).value == 'Kokapet'
    labels = [diamond.cell(row=row, column=1).value for row in range(10, diamond.max_row + 1)]
    assert 'Diamonds - Beads' in labels
    assert 'TOTAL' in labels
    assert 'GRAND TOTAL' in labels
    assert 'Di. Beads' not in labels

    precious = wb['Precious and Semi Precious']
    precious_labels = [
        precious.cell(row=row, column=1).value for row in range(10, precious.max_row + 1)
    ]
    assert 'Precious Stones' in precious_labels
    assert 'TOTAL - PRECIOUS STONES' in precious_labels

    emerald = wb['Emerald']
    emerald_labels = [emerald.cell(row=row, column=1).value for row in range(10, emerald.max_row + 1)]
    assert emerald_labels == ['GRAND TOTAL']

    for sheet_name in CLOSING_STOCK_CATEGORIES:
        ws = wb[sheet_name]
        for row in ws.iter_rows(min_row=10, max_row=ws.max_row, min_col=2, max_col=ws.max_column):
            for cell in row:
                assert not isinstance(cell.value, (int, float))
                assert cell.value is None or not str(cell.value).startswith('=')

    trading = wb['Trading']
    trading_labels = [
        trading.cell(row=row, column=1).value for row in range(1, trading.max_row + 1)
    ]
    assert 'GOLD ACCOUNT - 24K' in trading_labels
    assert 'DIAMONDS ACCOUNT' in trading_labels
    assert 'To Opening Stock' in trading_labels
    for row in trading.iter_rows(min_row=1, max_row=trading.max_row, min_col=2, max_col=7):
        for cell in row:
            assert not isinstance(cell.value, (int, float))

    abstract = wb['Abstract']
    assert abstract['A1'].value == 'Trading Account Abstract'
    abstract_labels = [
        abstract.cell(row=row, column=1).value for row in range(1, abstract.max_row + 1)
    ]
    assert 'Gold Account 24K' in abstract_labels
    assert abstract_labels.index('Gold Account 14K') < abstract_labels.index('Platinum Account')
    assert abstract_labels.index('Platinum Account') < abstract_labels.index('Gold Account Jadau')
    assert abstract_labels.index('Gold Account Jadau') < abstract_labels.index('Silver Account')
    assert 'Diamonds - Beads' in abstract_labels
    assert 'TOTAL' in abstract_labels
    for row in abstract.iter_rows(min_row=4, max_row=abstract.max_row, min_col=2, max_col=abstract.max_column):
        for cell in row:
            assert not isinstance(cell.value, (int, float))


def test_jubilee_hills_abstract_fills_platinum_and_jadau_with_gold_accounts():
    raw = build_jubilee_hills_workbook_bytes(
        layout_by_category={'Diamond': [{'kind': 'grand_total', 'label': 'GRAND TOTAL'}]},
        opening_pivot=[
            {'product': 'Standard Gold 24K', 'sumOfQuantity': 10, 'sumOfGross': 1000},
            {'product': 'Gold Platinum', 'sumOfQuantity': 164.645, 'sumOfGross': 618634},
            {'product': 'Gold Ornaments Jadau', 'sumOfQuantity': 5, 'sumOfGross': 500},
        ],
        purchases_pivot=[
            {'product': 'Gold Platinum', 'sumOfQuantity': 1, 'sumOfGross': 4000},
            {'product': 'Gold Ornaments Jadau', 'sumOfQuantity': 2, 'sumOfGross': 200},
        ],
        sales_pivot=[
            {'product': 'Gold Platinum', 'sumOfQuantity': 3, 'sumOfGross': 12000},
            {'product': 'Gold Ornaments Jadau', 'sumOfQuantity': 1, 'sumOfGross': 110},
        ],
    )
    ws = load_workbook(BytesIO(raw))['Abstract']
    labels = [ws.cell(row=row, column=1).value for row in range(1, ws.max_row + 1)]
    assert labels.index('Gold Account 14K') < labels.index('Platinum Account')
    assert labels.index('Platinum Account') < labels.index('Gold Account Jadau')
    assert labels.index('Gold Account Jadau') < labels.index('Silver Account')

    def row_for(label):
        for r in range(4, ws.max_row + 1):
            if ws.cell(row=r, column=1).value == label:
                return r
        raise AssertionError(label)

    platinum = row_for('Platinum Account')
    jadau = row_for('Gold Account Jadau')
    gold24 = row_for('Gold Account 24K')
    assert ws.cell(row=gold24, column=2).value == 10
    assert ws.cell(row=platinum, column=2).value == 164.645
    assert ws.cell(row=platinum, column=3).value == 618634
    assert ws.cell(row=platinum, column=4).value == 1
    assert ws.cell(row=platinum, column=5).value == 4000
    assert ws.cell(row=jadau, column=2).value == 5
    assert ws.cell(row=jadau, column=3).value == 500
    assert ws.cell(row=jadau, column=4).value == 2
    assert ws.cell(row=jadau, column=5).value == 200

"""Abstract sheet structure tests (grouped labels, no values)."""

from io import BytesIO

import pytest
from openpyxl import load_workbook

from app.engines.financials_engine.engine.abstract_template import (
    ABSTRACT_BODY_ROWS,
    ABSTRACT_MEASURE_GROUPS,
    ABSTRACT_SHEET_NAME,
    ABSTRACT_TITLE,
    abstract_column_span,
)
from app.engines.financials_engine.engine.closing_stock_template import (
    CLOSING_STOCK_CATEGORIES,
    build_closing_stock_template_bytes,
)
from app.engines.financials_engine.engine.trading_template import TRADING_SHEET_NAME


class TestAbstractSheet:
    def test_sheet_is_appended_after_trading_without_renaming_existing_sheets(self):
        raw = build_closing_stock_template_bytes(
            products_by_category={category: [] for category in CLOSING_STOCK_CATEGORIES}
        )
        wb = load_workbook(BytesIO(raw))
        assert wb.sheetnames == list(CLOSING_STOCK_CATEGORIES) + [
            TRADING_SHEET_NAME,
            ABSTRACT_SHEET_NAME,
        ]
        assert wb[ABSTRACT_SHEET_NAME].title == 'Abstract'
        assert wb.sheetnames.count(ABSTRACT_SHEET_NAME) == 1

    def test_title_and_two_level_headers(self):
        raw = build_closing_stock_template_bytes()
        ws = load_workbook(BytesIO(raw))[ABSTRACT_SHEET_NAME]
        assert ws.cell(row=1, column=1).value == ABSTRACT_TITLE
        assert ws.cell(row=2, column=1).value == 'Particulars'
        assert ws.cell(row=3, column=1).value is None

        col = 2
        for group in ABSTRACT_MEASURE_GROUPS:
            span = abstract_column_span(group)
            assert ws.cell(row=2, column=col).value == group
            if span == 2:
                assert ws.cell(row=3, column=col).value == 'Qty in Gms / Cts'
                assert ws.cell(row=3, column=col + 1).value == 'Amount in Rs'
            else:
                assert ws.cell(row=3, column=col).value is None
            col += span

    def test_grouped_particulars_order_without_values(self):
        raw = build_closing_stock_template_bytes()
        ws = load_workbook(BytesIO(raw))[ABSTRACT_SHEET_NAME]

        labels = []
        for offset, (kind, label) in enumerate(ABSTRACT_BODY_ROWS):
            row = 4 + offset
            assert ws.cell(row=row, column=1).value == label
            if kind != 'spacer':
                labels.append(label)

        assert labels == [
            'Gold Account 24K',
            'Gold Account 22K',
            'Gold Account 18K',
            'Gold Account 14K',
            'Silver Account',
            'Diamonds Account',
            'Emeralds',
            'Pearls',
            'Rubies',
            'Color Stones Account',
            'TOTAL',
            'Particulars',
            'DIAMONDS',
            'Diamonds - Beads',
            'Diamonds Rosecut diamonds',
            'Diamonds - Flat polki',
            'Uncut - diamonds',
            'Diamonds',
            'Total Diamonds',
            'COLOR STONES',
            'Precious Stones',
            'Semi Precious',
            'Synthetic Stones',
            'TOTAL Colour Stones',
        ]
        assert labels.index('TOTAL') < labels.index('Particulars')
        assert labels.index('DIAMONDS') < labels.index('COLOR STONES')
        assert labels.index('Total Diamonds') < labels.index('COLOR STONES')

    def test_copies_trading_account_values_without_changing_trading_sheet(self):
        diamond_total = {
            'kind': 'grand_total',
            'label': 'GRAND TOTAL',
            'openingQty': 11,
            'openingAmt': 110,
            'purchasesQty': 12,
            'purchasesAmt': 120,
            'salesQty': 13,
            'salesAmt': 130,
            'closingStockQty': 14,
            'closingStockAmt': 140,
            'receiptsJubileeHillsQty': 5,
            'receiptsJubileeHillsAmt': 50,
            'receiptsInternalQty': 2,
            'receiptsInternalAmt': 20,
            'issuesInternalQty': 1,
            'issuesInternalAmt': 10,
            'issuesBanjaraHillsQty': 3,
            'issuesBanjaraHillsAmt': 30,
            'issuesTotalQty': 4,
            'issuesTotalAmt': 40,
        }
        beads = {
            'kind': 'subcategory_total',
            'subcategory': 'Diamonds - Beads',
            'openingQty': 4,
            'openingAmt': 40,
            'purchasesQty': 1,
            'purchasesAmt': 10,
            'salesQty': 2,
            'salesAmt': 20,
            'closingStockQty': 3,
            'closingStockAmt': 30,
        }
        rosecut = {
            'kind': 'subcategory_total',
            'subcategory': 'Diamonds Rosecut diamonds',
            'openingQty': 7,
            'openingAmt': 70,
            'purchasesQty': 11,
            'purchasesAmt': 110,
            'salesQty': 11,
            'salesAmt': 110,
            'closingStockQty': 11,
            'closingStockAmt': 110,
        }
        precious = {
            'kind': 'subcategory_total',
            'subcategory': 'Precious Stones',
            'openingQty': 8,
            'openingAmt': 80,
            'salesQty': 1,
            'salesAmt': 10,
            'closingStockQty': 7,
            'closingStockAmt': 70,
        }
        semi = {
            'kind': 'subcategory_total',
            'subcategory': 'Semi Precious',
            'openingQty': 2,
            'openingAmt': 20,
            'salesQty': 0,
            'salesAmt': 0,
            'closingStockQty': 2,
            'closingStockAmt': 20,
        }
        raw = build_closing_stock_template_bytes(
            layout_by_category={
                'Diamond': [beads, rosecut, diamond_total],
                'Precious and Semi Precious': [precious, semi],
            },
            sales_pivot=[
                {'product': 'Standard Gold 24K', 'sumOfQuantity': 2, 'sumOfGross': 200},
            ],
            purchases_pivot=[
                {'product': 'standard gold 24 k', 'sumOfQuantity': 4, 'sumOfGross': 400},
            ],
            opening_pivot=[
                {'product': 'Standard Gold 24K', 'sumOfQuantity': 10, 'sumOfGross': 1000},
            ],
        )
        wb = load_workbook(BytesIO(raw))
        trading = wb[TRADING_SHEET_NAME]
        gold24 = 3
        assert trading.cell(row=gold24, column=2).value == 10
        assert trading.cell(row=gold24, column=3).value == 1000
        assert trading.cell(row=gold24 + 1, column=2).value == 4
        assert trading.cell(row=gold24, column=6).value == 2
        assert trading.cell(row=gold24 + 4, column=6).value == 12
        assert trading.cell(row=gold24 + 4, column=3).value == 0

        abstract = wb[ABSTRACT_SHEET_NAME]
        gold_row = _abstract_row(abstract, 'Gold Account 24K')
        assert abstract.cell(row=gold_row, column=2).value == 10
        assert abstract.cell(row=gold_row, column=3).value == 1000
        assert abstract.cell(row=gold_row, column=4).value == 4
        assert abstract.cell(row=gold_row, column=5).value == 400
        assert abstract.cell(row=gold_row, column=18).value == 2
        assert abstract.cell(row=gold_row, column=19).value == 200
        assert abstract.cell(row=gold_row, column=20).value == 12
        assert abstract.cell(row=gold_row, column=21).value == 1200
        assert abstract.cell(row=gold_row, column=22).value == 0

        diamonds = _abstract_row(abstract, 'Diamonds Account')
        assert abstract.cell(row=diamonds, column=2).value == 11
        assert abstract.cell(row=diamonds, column=3).value == 110
        assert abstract.cell(row=diamonds, column=4).value == 12
        assert abstract.cell(row=diamonds, column=5).value == 120
        assert abstract.cell(row=diamonds, column=6).value == 5
        assert abstract.cell(row=diamonds, column=7).value == 50
        assert abstract.cell(row=diamonds, column=8).value == 2
        assert abstract.cell(row=diamonds, column=9).value == 20
        assert abstract.cell(row=diamonds, column=10).value == 1
        assert abstract.cell(row=diamonds, column=11).value == 10
        assert abstract.cell(row=diamonds, column=12).value == 3
        assert abstract.cell(row=diamonds, column=13).value == 30
        assert abstract.cell(row=diamonds, column=14).value == 4
        assert abstract.cell(row=diamonds, column=15).value == 40
        assert abstract.cell(row=diamonds, column=18).value == 13
        assert abstract.cell(row=diamonds, column=19).value == 130
        assert abstract.cell(row=diamonds, column=20).value == 14
        assert abstract.cell(row=diamonds, column=21).value == 140
        assert abstract.cell(row=diamonds, column=22).value == 40
        assert abstract.cell(row=diamonds, column=23).value == pytest.approx(40 / 130 * 100)

        beads_row = _abstract_row(abstract, 'Diamonds - Beads')
        assert abstract.cell(row=beads_row, column=2).value == 4
        assert abstract.cell(row=beads_row, column=3).value == 40
        total_diamonds = _abstract_row(abstract, 'Total Diamonds')
        assert abstract.cell(row=total_diamonds, column=2).value == 11
        assert abstract.cell(row=total_diamonds, column=3).value == 110
        assert abstract.cell(row=total_diamonds, column=4).value == 12
        assert abstract.cell(row=total_diamonds, column=5).value == 120

        colour = _abstract_row(abstract, 'TOTAL Colour Stones')
        assert abstract.cell(row=colour, column=2).value == 10
        assert abstract.cell(row=colour, column=3).value == 100

        heading = _abstract_row(abstract, 'DIAMONDS')
        assert abstract.cell(row=heading, column=2).value is None


def _abstract_row(ws, label: str) -> int:
    for row in range(4, ws.max_row + 1):
        if ws.cell(row=row, column=1).value == label:
            return row
    raise AssertionError(f'{label} not found')


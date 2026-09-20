"""Trading sheet T-account structure tests (layout only)."""

from io import BytesIO

from openpyxl import load_workbook

from app.engines.financials_engine.engine.closing_stock_template import (
    CLOSING_STOCK_CATEGORIES,
    build_closing_stock_template_bytes,
)
from app.engines.financials_engine.engine.metal_trading import metal_closing_amt, metal_closing_qty
from app.engines.financials_engine.engine.trading_template import (
    TRADING_ACCOUNTS,
    TRADING_METAL_ACCOUNTS,
    TRADING_SHEET_NAME,
    _account_block_height,
)


def _account_start_rows() -> dict[str, int]:
    starts: dict[str, int] = {}
    row = 1
    for account in TRADING_METAL_ACCOUNTS:
        row += _account_block_height(account)
    for account in TRADING_ACCOUNTS:
        starts[str(account['title'])] = row
        row += _account_block_height(account)
    return starts


def _metal_start_rows() -> dict[str, int]:
    starts: dict[str, int] = {}
    row = 1
    for account in TRADING_METAL_ACCOUNTS:
        starts[str(account['title'])] = row
        row += _account_block_height(account)
    return starts


class TestMetalClosingQty:
    def test_includes_from_ho_and_purchase_difference(self):
        assert metal_closing_qty(
            {
                'openingQty': 10,
                'netPurchasesQty': 10,
                'receiptsJubileeHillsQty': 5,
                'issuesBanjaraHillsQty': 0,
                'netSalesQty': 0,
            }
        ) == 25

    def test_subtracts_transfer_to_ho(self):
        assert metal_closing_qty(
            {
                'openingQty': 10,
                'netPurchasesQty': 4,
                'receiptsJubileeHillsQty': 0,
                'issuesBanjaraHillsQty': 3,
                'netSalesQty': 0,
            }
        ) == 11

    def test_amount_is_qty_times_net_rate(self):
        assert metal_closing_amt(
            {
                'openingQty': 10,
                'openingAmt': 2000,
                'netPurchasesQty': 10,
                'netPurchasesAmt': 2000,
                'receiptsJubileeHillsQty': 5,
                'netSalesQty': 0,
            }
        ) == 4000


class TestTradingSheet:
    def test_sheet_is_appended_without_renaming_existing_sheets(self):
        raw = build_closing_stock_template_bytes(
            products_by_category={category: [] for category in CLOSING_STOCK_CATEGORIES}
        )
        wb = load_workbook(BytesIO(raw))
        assert wb.sheetnames == list(CLOSING_STOCK_CATEGORIES) + [TRADING_SHEET_NAME, 'Abstract']
        assert TRADING_SHEET_NAME in wb.sheetnames
        assert wb[TRADING_SHEET_NAME].title == 'Trading'

    def test_five_accounts_in_order_with_t_headers(self):
        raw = build_closing_stock_template_bytes()
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        starts = _account_start_rows()
        expected_titles = [str(account['title']) for account in TRADING_ACCOUNTS]
        assert expected_titles == [
            'DIAMONDS ACCOUNT',
            'EMERALDS ACCOUNT',
            'RUBIES ACCOUNT',
            'PEARLS ACCOUNT',
            'COLOR STONES ACCOUNT',
        ]
        for title, start in starts.items():
            assert ws.cell(row=start, column=1).value == title
            header = start + 1
            assert ws.cell(row=header, column=1).value == 'Particulars'
            assert ws.cell(row=header, column=3).value == 'Amount'
            assert ws.cell(row=header, column=5).value == 'Particulars'
            assert ws.cell(row=header, column=7).value == 'Amount'

        assert ws.cell(row=starts['DIAMONDS ACCOUNT'] + 1, column=2).value == 'Qty (Cts)'
        assert ws.cell(row=starts['EMERALDS ACCOUNT'] + 1, column=2).value == 'Qty (Cts)'
        assert ws.cell(row=starts['RUBIES ACCOUNT'] + 1, column=2).value == 'Qty (Cts)'
        assert ws.cell(row=starts['PEARLS ACCOUNT'] + 1, column=2).value == 'Qty (Grms)'
        assert ws.cell(row=starts['COLOR STONES ACCOUNT'] + 1, column=2).value == 'Qty (Cts)'
        assert ws.cell(row=starts['PEARLS ACCOUNT'] + 1, column=6).value == 'Qty (Grms)'

    def test_metal_accounts_are_blank_structure_above_gemstone_block(self):
        raw = build_closing_stock_template_bytes()
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        metal = _metal_start_rows()
        gems = _account_start_rows()
        assert list(metal) == [
            'GOLD ACCOUNT - 24K',
            'GOLD ORNAMENTS ACCOUNT - 22K',
            'GOLD ORNAMENTS ACCOUNT - 18K',
            'GOLD ORNAMENTS ACCOUNT - 14K',
            'SILVER ACCOUNT',
        ]
        assert metal['GOLD ACCOUNT - 24K'] == 1
        assert gems['DIAMONDS ACCOUNT'] > metal['SILVER ACCOUNT']

        gold24 = metal['GOLD ACCOUNT - 24K'] + 2
        assert [ws.cell(row=gold24 + i, column=1).value for i in range(6)] == [
            'To Opening Stock',
            'To Purchases',
            'Less: Purchase Returns',
            'Difference',
            'To Gross Profit',
            'Total',
        ]
        assert [ws.cell(row=gold24 + i, column=5).value for i in range(6)] == [
            'By Sales',
            'Less: Sales Returns',
            'Difference',
            'By Transfer to Head Office',
            'By Closing stock',
            'Total',
        ]
        assert ws.cell(row=metal['GOLD ACCOUNT - 24K'] + 1, column=2).value == 'Qty (Grms)'

        gold22 = metal['GOLD ORNAMENTS ACCOUNT - 22K'] + 2
        assert ws.cell(row=gold22 + 3, column=1).value == 'Difference'
        assert ws.cell(row=gold22 + 4, column=1).value == 'To Transfer from Head Office'
        assert ws.cell(row=gold22 + 5, column=1).value == 'To Making Charges'
        assert ws.cell(row=gold22 + 1, column=5).value == 'Less: Sales Returns'
        assert ws.cell(row=gold22 + 2, column=5).value == 'Difference'

        gold18 = metal['GOLD ORNAMENTS ACCOUNT - 18K'] + 2
        assert ws.cell(row=gold18 + 2, column=1).value == 'Less: Returns'
        assert ws.cell(row=gold18 + 3, column=1).value == 'Difference'
        assert ws.cell(row=gold18 + 1, column=5).value == 'Less: Returns'
        assert ws.cell(row=gold18 + 2, column=5).value == 'Difference'

        gold14 = metal['GOLD ORNAMENTS ACCOUNT - 14K'] + 2
        assert ws.cell(row=gold14 + 2, column=1).value == 'Less: Purchase Returns'
        assert ws.cell(row=gold14 + 3, column=1).value == 'Difference'
        assert ws.cell(row=gold14 + 4, column=1).value == 'To Transfer from Head Office'
        assert ws.cell(row=gold14 + 1, column=5).value == 'Less: Sales Returns'
        assert ws.cell(row=gold14 + 2, column=5).value == 'Difference'

        silver = metal['SILVER ACCOUNT'] + 2
        assert ws.cell(row=silver + 2, column=1).value == 'Less: Returns'
        assert ws.cell(row=silver + 3, column=1).value == 'Difference'
        assert ws.cell(row=silver + 4, column=1).value == 'To Transfer from Head Office'

        for title, start in metal.items():
            header = start + 1
            assert ws.cell(row=header, column=2).value == 'Qty (Grms)'
            assert ws.cell(row=header, column=6).value == 'Qty (Grms)'
            for row in range(header + 1, start + _account_block_height(
                next(a for a in TRADING_METAL_ACCOUNTS if a['title'] == title)
            ) - 3):
                assert ws.cell(row=row, column=2).value is None
                assert ws.cell(row=row, column=3).value is None
                assert ws.cell(row=row, column=6).value is None
                assert ws.cell(row=row, column=7).value is None

    def test_metal_accounts_fill_opening_purchases_sales_closing_from_pivots(self):
        raw = build_closing_stock_template_bytes(
            sales_pivot=[
                {'product': 'Standard Gold 24K', 'sumOfQuantity': 2, 'sumOfGross': 200},
                {'product': 'Customer Gold Ornaments 22K', 'sumOfQuantity': 1, 'sumOfGross': 90},
                {'product': 'Gold Ornaments 22K', 'sumOfQuantity': 3, 'sumOfGross': 270},
                {'product': 'Round Brilliant 0.30', 'sumOfQuantity': 50, 'sumOfGross': 999},
            ],
            purchases_pivot=[
                {'product': 'standard gold 24 k', 'sumOfQuantity': 4, 'sumOfGross': 400},
                {'product': 'Gold Ornaments 18K', 'sumOfQuantity': 6, 'sumOfGross': 1800},
                {'product': 'Gold Ornaments 14K', 'sumOfQuantity': 7, 'sumOfGross': 1400},
                {'product': 'Silver articles', 'sumOfQuantity': 8, 'sumOfGross': 80},
            ],
            opening_pivot=[
                {'product': 'Standard Gold 24K', 'sumOfQuantity': 10, 'sumOfGross': 1000},
                {'product': 'Gold Ornaments Jadau', 'sumOfQuantity': 9, 'sumOfGross': 900},
            ],
        )
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        metal = _metal_start_rows()

        gold24 = metal['GOLD ACCOUNT - 24K'] + 2
        assert ws.cell(row=gold24, column=2).value == 10
        assert ws.cell(row=gold24, column=3).value == 1000
        assert ws.cell(row=gold24 + 1, column=2).value == 4
        assert ws.cell(row=gold24 + 1, column=3).value == 400
        assert ws.cell(row=gold24, column=6).value == 2
        assert ws.cell(row=gold24, column=7).value == 200
        assert ws.cell(row=gold24 + 2, column=1).value == 'Less: Purchase Returns'
        assert ws.cell(row=gold24 + 2, column=2).value is None
        assert ws.cell(row=gold24 + 3, column=1).value == 'Difference'
        assert ws.cell(row=gold24 + 3, column=2).value == 4
        assert ws.cell(row=gold24 + 3, column=3).value == 400
        assert ws.cell(row=gold24 + 1, column=5).value == 'Less: Sales Returns'
        assert ws.cell(row=gold24 + 2, column=5).value == 'Difference'
        assert ws.cell(row=gold24 + 2, column=6).value == 2
        assert ws.cell(row=gold24 + 2, column=7).value == 200
        assert ws.cell(row=gold24 + 4, column=5).value == 'By Closing stock'
        assert ws.cell(row=gold24 + 4, column=6).value == 12
        assert ws.cell(row=gold24 + 4, column=7).value == 1200
        assert ws.cell(row=gold24 + 4, column=1).value == 'To Gross Profit'
        assert ws.cell(row=gold24 + 4, column=3).value == 0
        assert ws.cell(row=gold24 + 5, column=1).value == 'Total'
        assert ws.cell(row=gold24 + 5, column=2).value == 14
        assert ws.cell(row=gold24 + 5, column=3).value == 1400
        assert ws.cell(row=gold24 + 5, column=6).value == 14
        assert ws.cell(row=gold24 + 5, column=7).value == 1400
        assert ws.cell(row=gold24 + 3, column=5).value == 'By Transfer to Head Office'
        assert ws.cell(row=gold24 + 3, column=6).value is None

        gold22 = metal['GOLD ORNAMENTS ACCOUNT - 22K'] + 2
        assert ws.cell(row=gold22, column=2).value is None
        assert ws.cell(row=gold22 + 1, column=2).value is None
        assert ws.cell(row=gold22, column=6).value == 4
        assert ws.cell(row=gold22, column=7).value == 360
        assert ws.cell(row=gold22 + 2, column=5).value == 'Difference'
        assert ws.cell(row=gold22 + 2, column=6).value == 4
        assert ws.cell(row=gold22 + 2, column=7).value == 360
        assert ws.cell(row=gold22 + 3, column=5).value == 'By Closing stock'
        assert ws.cell(row=gold22 + 3, column=6).value == -4
        assert ws.cell(row=gold22 + 3, column=7).value == 0
        assert ws.cell(row=gold22 + 6, column=1).value == 'To Gross Profit'
        assert ws.cell(row=gold22 + 6, column=3).value == 360
        assert ws.cell(row=gold22 + 7, column=2).value is None
        assert ws.cell(row=gold22 + 7, column=3).value == 360
        assert ws.cell(row=gold22 + 7, column=6).value == 0
        assert ws.cell(row=gold22 + 7, column=7).value == 360

        gold18 = metal['GOLD ORNAMENTS ACCOUNT - 18K'] + 2
        assert ws.cell(row=gold18 + 1, column=2).value == 6
        assert ws.cell(row=gold18 + 1, column=3).value == 1800
        assert ws.cell(row=gold18 + 3, column=1).value == 'Difference'
        assert ws.cell(row=gold18 + 3, column=2).value == 6
        assert ws.cell(row=gold18 + 3, column=3).value == 1800
        assert ws.cell(row=gold18 + 2, column=5).value == 'Difference'
        assert ws.cell(row=gold18 + 2, column=6).value is None
        assert ws.cell(row=gold18 + 3, column=5).value == 'By Closing stock'
        assert ws.cell(row=gold18 + 3, column=6).value == 6
        assert ws.cell(row=gold18 + 3, column=7).value == 1800

        gold14 = metal['GOLD ORNAMENTS ACCOUNT - 14K'] + 2
        assert ws.cell(row=gold14 + 1, column=2).value == 7
        assert ws.cell(row=gold14 + 1, column=3).value == 1400
        assert ws.cell(row=gold14 + 3, column=1).value == 'Difference'
        assert ws.cell(row=gold14 + 3, column=2).value == 7
        assert ws.cell(row=gold14 + 3, column=3).value == 1400
        assert ws.cell(row=gold14 + 2, column=5).value == 'Difference'
        assert ws.cell(row=gold14 + 3, column=5).value == 'By Closing stock'
        assert ws.cell(row=gold14 + 3, column=6).value == 7
        assert ws.cell(row=gold14 + 3, column=7).value == 1400

        silver = metal['SILVER ACCOUNT'] + 2
        assert ws.cell(row=silver + 1, column=2).value == 8
        assert ws.cell(row=silver + 1, column=3).value == 80
        assert ws.cell(row=silver + 3, column=1).value == 'Difference'
        assert ws.cell(row=silver + 3, column=2).value == 8
        assert ws.cell(row=silver + 3, column=3).value == 80
        assert ws.cell(row=silver + 2, column=5).value == 'Difference'
        assert ws.cell(row=silver + 3, column=5).value == 'By Closing stock'
        assert ws.cell(row=silver + 3, column=6).value == 8
        assert ws.cell(row=silver + 3, column=7).value == 80

        diamonds = _account_start_rows()['DIAMONDS ACCOUNT'] + 2
        assert ws.cell(row=diamonds, column=1).value == 'To Opening Stock'
        assert ws.cell(row=diamonds, column=2).value is None

    def test_metal_head_office_uses_product_sheet_mr_dc_net(self):
        raw = build_closing_stock_template_bytes(
            opening_pivot=[
                {'product': 'Standard Gold 24K', 'sumOfQuantity': 10, 'sumOfGross': 1000},
                {'product': 'Gold Ornaments 22K', 'sumOfQuantity': 10, 'sumOfGross': 2000},
            ],
            purchases_pivot=[
                {'product': 'Standard Gold 24K', 'sumOfQuantity': 4, 'sumOfGross': 400},
                {'product': 'Gold Ornaments 22K', 'sumOfQuantity': 10, 'sumOfGross': 2000},
            ],
            mr_pivots={
                'jubileeHills': [
                    {'product': 'Gold Ornaments 22K', 'sumOfQuantity': 5, 'sumOfGross': 0},
                ],
                'kokapet': [
                    {'product': 'Standard Gold 24K', 'sumOfQuantity': 7, 'sumOfGross': 0},
                ],
            },
            dc_pivots={
                'jubileeHills': [
                    {'product': 'Standard Gold 24K', 'sumOfQuantity': 3, 'sumOfGross': 0},
                ],
            },
        )
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        metal = _metal_start_rows()

        gold24 = metal['GOLD ACCOUNT - 24K'] + 2
        assert ws.cell(row=gold24 + 3, column=5).value == 'By Transfer to Head Office'
        assert ws.cell(row=gold24 + 3, column=6).value == 3
        assert ws.cell(row=gold24 + 3, column=7).value == 300
        assert ws.cell(row=gold24 + 3, column=1).value == 'Difference'

        gold22 = metal['GOLD ORNAMENTS ACCOUNT - 22K'] + 2
        assert ws.cell(row=gold22 + 4, column=1).value == 'To Transfer from Head Office'
        assert ws.cell(row=gold22 + 4, column=2).value == 5
        assert ws.cell(row=gold22 + 4, column=3).value is None
        assert ws.cell(row=gold22 + 3, column=5).value == 'By Closing stock'
        assert ws.cell(row=gold22 + 3, column=6).value == 25
        assert ws.cell(row=gold22 + 3, column=7).value == 4000
        gold24_close = metal['GOLD ACCOUNT - 24K'] + 2
        assert ws.cell(row=gold24_close + 4, column=5).value == 'By Closing stock'
        assert ws.cell(row=gold24_close + 4, column=6).value == 11
        assert ws.cell(row=gold24_close + 4, column=7).value == 1100
        assert ws.cell(row=gold24_close + 4, column=1).value == 'To Gross Profit'
        assert ws.cell(row=gold24_close + 4, column=3).value == 0
        assert ws.cell(row=gold24_close + 5, column=3).value == 1400
        assert ws.cell(row=gold24_close + 5, column=7).value == 1400
        assert ws.cell(row=gold22 + 1, column=5).value == 'Less: Sales Returns'
        assert ws.cell(row=gold22 + 1, column=6).value is None
        assert ws.cell(row=gold22 + 7, column=2).value == 25
        assert ws.cell(row=gold22 + 7, column=3).value == 4000
        assert ws.cell(row=gold22 + 7, column=6).value == 25
        assert ws.cell(row=gold22 + 7, column=7).value == 4000
        assert ws.cell(row=gold22 + 6, column=1).value == 'To Gross Profit'
        assert ws.cell(row=gold22 + 6, column=3).value == 0

    def test_line_labels_and_aligned_totals(self):
        raw = build_closing_stock_template_bytes()
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        starts = _account_start_rows()

        diamonds = starts['DIAMONDS ACCOUNT'] + 2
        assert [ws.cell(row=diamonds + i, column=1).value for i in range(4)] == [
            'To Opening Stock',
            'To Purchases',
            'To Gross Profit',
            'Total',
        ]
        assert ws.cell(row=diamonds, column=5).value == 'By Sales'
        assert ws.cell(row=diamonds + 1, column=5).value == 'By Closing stock'
        assert ws.cell(row=diamonds + 2, column=5).value is None
        assert ws.cell(row=diamonds + 3, column=5).value == 'Total'
        diamond_left = [
            ws.cell(row=r, column=1).value
            for r in range(starts['DIAMONDS ACCOUNT'], (ws.max_row or 1) + 1)
        ]
        assert 'To Transfer from Head Office' not in diamond_left
        assert 'By Transfer to Head Office' not in [
            ws.cell(row=r, column=5).value
            for r in range(starts['DIAMONDS ACCOUNT'], starts['DIAMONDS ACCOUNT'] + 6)
        ]

        rubies = starts['RUBIES ACCOUNT'] + 2
        assert [ws.cell(row=rubies + i, column=1).value for i in range(4)] == [
            'To Opening Stock',
            'To Purchases',
            'To Gross Profit',
            'Total',
        ]
        assert [ws.cell(row=rubies + i, column=5).value for i in range(4)] == [
            'By Sales',
            'By Closing stock',
            None,
            'Total',
        ]

        pearls = starts['PEARLS ACCOUNT'] + 2
        assert ws.cell(row=pearls + 1, column=5).value == 'By Closing stock'
        color = starts['COLOR STONES ACCOUNT'] + 2
        assert ws.cell(row=color + 1, column=5).value == 'By Closing stock'

        emeralds = starts['EMERALDS ACCOUNT'] + 2
        assert ws.cell(row=emeralds + 2, column=1).value == 'To Gross Profit'

    def test_blank_without_layout_grand_totals(self):
        raw = build_closing_stock_template_bytes()
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        header_labels = {'Particulars', 'Amount', 'Qty (Cts)', 'Qty (Grms)'}
        qty_amt_cols = (2, 3, 6, 7)
        gem_start = _account_start_rows()['DIAMONDS ACCOUNT']
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row, min_col=1, max_col=7):
            labels = {row[0].value, row[4].value}
            is_gp = 'To Gross Profit' in labels
            is_total = 'Total' in labels
            in_gemstone_block = row[0].row >= gem_start
            for cell in row:
                if isinstance(cell.value, str) and str(cell.value).startswith('='):
                    raise AssertionError(f'Unexpected formula at {cell.coordinate}: {cell.value}')
                if cell.column not in qty_amt_cols or cell.value in header_labels:
                    continue
                if is_gp and cell.column in (3, 7):
                    if in_gemstone_block:
                        assert cell.value in (0, 0.0, None) or cell.value == 0
                    else:
                        assert cell.value is None
                    continue
                if is_gp and cell.column in (2, 6):
                    assert cell.value is None
                    continue
                if is_total:
                    if in_gemstone_block:
                        assert cell.value in (0, 0.0)
                    else:
                        assert cell.value is None
                    continue
                assert cell.value is None, cell.coordinate

    def test_copies_grand_totals_for_opening_purchases_sales_closing(self):
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
            'receiptsQty': 99,
            'grossProfitAmt': 88,
        }
        rubie_total = {
            'kind': 'grand_total',
            'label': 'GRAND TOTAL',
            'openingQty': 21,
            'openingAmt': 210,
            'purchasesQty': 22,
            'purchasesAmt': 220,
            'salesQty': 23,
            'salesAmt': 230,
            'closingStockQty': 24,
            'closingStockAmt': 240,
        }
        raw = build_closing_stock_template_bytes(
            layout_by_category={
                'Diamond': [diamond_total],
                'Emerald': [],
                'Pearls': [],
                'Rubie': [rubie_total],
                'Precious and Semi Precious': [],
            }
        )
        wb = load_workbook(BytesIO(raw))
        ws = wb[TRADING_SHEET_NAME]
        starts = _account_start_rows()

        diamonds = starts['DIAMONDS ACCOUNT'] + 2
        assert ws.cell(row=diamonds, column=2).value == 11
        assert ws.cell(row=diamonds, column=3).value == 110
        assert ws.cell(row=diamonds + 1, column=2).value == 12
        assert ws.cell(row=diamonds + 1, column=3).value == 120
        assert ws.cell(row=diamonds, column=6).value == 13
        assert ws.cell(row=diamonds, column=7).value == 130
        assert ws.cell(row=diamonds + 1, column=6).value == 14
        assert ws.cell(row=diamonds + 1, column=7).value == 140
        assert ws.cell(row=diamonds + 2, column=1).value == 'To Gross Profit'
        assert ws.cell(row=diamonds + 2, column=2).value is None
        assert ws.cell(row=diamonds + 2, column=3).value == 40
        assert ws.cell(row=diamonds + 3, column=1).value == 'Total'
        assert ws.cell(row=diamonds + 3, column=2).value == 23
        assert ws.cell(row=diamonds + 3, column=3).value == 270
        assert ws.cell(row=diamonds + 3, column=6).value == 27
        assert ws.cell(row=diamonds + 3, column=7).value == 270

        rubies = starts['RUBIES ACCOUNT'] + 2
        assert ws.cell(row=rubies, column=2).value == 21
        assert ws.cell(row=rubies + 1, column=3).value == 220
        assert ws.cell(row=rubies, column=6).value == 23
        assert ws.cell(row=rubies + 1, column=5).value == 'By Closing stock'
        assert ws.cell(row=rubies + 1, column=6).value == 24
        assert ws.cell(row=rubies + 1, column=7).value == 240

        diamond_sheet = wb['Diamond']
        assert diamond_sheet['A4'].value == 'DETAILS OF JEWELS CLOSING STOCK - DIAMOND'

    def test_transfer_from_head_office_when_jubilee_qty_positive(self):
        raw = build_closing_stock_template_bytes(
            layout_by_category={
                'Diamond': [
                    {
                        'kind': 'grand_total',
                        'openingQty': 1,
                        'receiptsJubileeHillsQty': 10,
                        'receiptsJubileeHillsAmt': 100,
                        'issuesBanjaraHillsQty': 2.5,
                        'issuesBanjaraHillsAmt': 25,
                    }
                ]
            }
        )
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        diamonds = _account_start_rows()['DIAMONDS ACCOUNT'] + 2
        assert ws.cell(row=diamonds + 2, column=1).value == 'To Transfer from Head Office'
        assert ws.cell(row=diamonds + 2, column=2).value == 7.5
        assert ws.cell(row=diamonds + 2, column=3).value is None
        assert ws.cell(row=diamonds + 3, column=1).value == 'To Gross Profit'
        assert 'By Transfer to Head Office' not in [
            ws.cell(row=r, column=5).value for r in range(diamonds, diamonds + 6)
        ]

    def test_ho_amount_is_abs_difference_side_follows_qty_only(self):
        raw = build_closing_stock_template_bytes(
            layout_by_category={
                'Diamond': [
                    {
                        'kind': 'grand_total',
                        'receiptsJubileeHillsQty': 8,
                        'receiptsJubileeHillsAmt': 10,
                        'issuesBanjaraHillsQty': 2,
                        'issuesBanjaraHillsAmt': 50,
                    }
                ]
            }
        )
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        diamonds = _account_start_rows()['DIAMONDS ACCOUNT'] + 2
        assert ws.cell(row=diamonds + 2, column=1).value == 'To Transfer from Head Office'
        assert ws.cell(row=diamonds + 2, column=2).value == 6
        assert ws.cell(row=diamonds + 2, column=3).value is None

    def test_transfer_to_head_office_when_issues_exceed_receipts(self):
        raw = build_closing_stock_template_bytes(
            layout_by_category={
                'Rubie': [
                    {
                        'kind': 'grand_total',
                        'salesQty': 1,
                        'closingStockQty': 2,
                        'receiptsJubileeHillsQty': 1,
                        'receiptsJubileeHillsAmt': 10,
                        'issuesBanjaraHillsQty': 5,
                        'issuesBanjaraHillsAmt': 50,
                    }
                ]
            }
        )
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        rubies = _account_start_rows()['RUBIES ACCOUNT'] + 2
        # Positive Diamond transfer is absent, so Rubie start is unchanged vs skeleton.
        assert ws.cell(row=rubies, column=5).value == 'By Sales'
        assert ws.cell(row=rubies + 1, column=5).value == 'By Transfer to Head Office'
        assert ws.cell(row=rubies + 1, column=6).value == 4
        assert ws.cell(row=rubies + 1, column=7).value == 40
        assert ws.cell(row=rubies + 2, column=5).value == 'By Closing stock'
        gp_row = rubies + 2
        assert ws.cell(row=gp_row, column=1).value == 'To Gross Profit'
        assert ws.cell(row=gp_row, column=3).value == 40
        assert ws.cell(row=gp_row + 1, column=3).value == 40
        assert ws.cell(row=gp_row + 1, column=7).value == 40
        assert 'To Transfer from Head Office' not in [
            ws.cell(row=r, column=1).value for r in range(rubies, rubies + 6)
        ]

    def test_zero_jubilee_qty_hides_transfer_particulars(self):
        raw = build_closing_stock_template_bytes(
            layout_by_category={
                'Pearls': [
                    {
                        'kind': 'grand_total',
                        'receiptsJubileeHillsQty': 5,
                        'receiptsJubileeHillsAmt': 10,
                        'issuesBanjaraHillsQty': 5,
                        'issuesBanjaraHillsAmt': 10,
                    }
                ]
            }
        )
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        pearls = _account_start_rows()['PEARLS ACCOUNT'] + 2
        assert ws.cell(row=pearls + 1, column=5).value == 'By Closing stock'
        assert ws.cell(row=pearls + 2, column=1).value == 'To Gross Profit'

    def test_gross_profit_has_no_qty_value(self):
        raw = build_closing_stock_template_bytes()
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        starts = _account_start_rows()
        for title, start in starts.items():
            header = start + 1
            found = False
            for row in range(header + 1, start + 12):
                if ws.cell(row=row, column=1).value == 'To Gross Profit':
                    found = True
                    assert ws.cell(row=row, column=2).value is None
            assert found, title

    def test_gross_profit_and_totals_include_optional_from_ho(self):
        raw = build_closing_stock_template_bytes(
            layout_by_category={
                'Diamond': [
                    {
                        'kind': 'grand_total',
                        'openingQty': 1,
                        'openingAmt': 10,
                        'purchasesQty': 2,
                        'purchasesAmt': 20,
                        'salesQty': 3,
                        'salesAmt': 30,
                        'closingStockQty': 4,
                        'closingStockAmt': 100,
                        'receiptsJubileeHillsQty': 5,
                        'receiptsJubileeHillsAmt': 15,
                    }
                ]
            }
        )
        ws = load_workbook(BytesIO(raw))[TRADING_SHEET_NAME]
        diamonds = _account_start_rows()['DIAMONDS ACCOUNT'] + 2
        assert ws.cell(row=diamonds + 2, column=1).value == 'To Transfer from Head Office'
        assert ws.cell(row=diamonds + 3, column=1).value == 'To Gross Profit'
        assert ws.cell(row=diamonds + 3, column=2).value is None
        assert ws.cell(row=diamonds + 3, column=3).value == 100
        assert ws.cell(row=diamonds + 4, column=2).value == 8
        assert ws.cell(row=diamonds + 4, column=3).value == 130
        assert ws.cell(row=diamonds + 4, column=6).value == 7
        assert ws.cell(row=diamonds + 4, column=7).value == 130

"""Opening Stock: quantity file + previous-year Closing Stock product amounts."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook

from app.engines.financials_engine.config.product_rule_book import (
    map_pivots_to_closing_stock_categories,
)
from app.engines.financials_engine.engine.audit import validated_opening_to_pivot
from app.engines.financials_engine.engine.opening_stock import validate_opening_stock
from app.engines.financials_engine.parsers.opening_stock_loader import (
    load_previous_year_product_sheets,
)


def _prev_year_category_workbook_bytes() -> bytes:
    """Mirrors Eximp Dia/Eme Closing Stock layout (product rows, not one sheet per SKU)."""
    wb = Workbook()
    dia = wb.active
    dia.title = 'Dia'
    dia.append(['DETAILS OF JEWELS CLOSING STOCK - DIAMONDS'])
    dia.append(
        [
            'Particulars',
            'Opening stock',
            None,
            'Purchases',
            None,
            'Closing stock',
            None,
        ]
    )
    dia.append([1, '2  (Qty)', '3  (Amt.)', '4  (Qty)', '5  (Amt.)', '15 (Qty)', '16  (Amt.)'])
    dia.append(['Diamonds - Beads'])
    dia.append(['Di. Beads', 263.03, 100.0, 0, 0, 177.86, 234713.15])
    dia.append(['TOTAL', 263.03, 100.0, 0, 0, 177.86, 234713.15])
    dia.append(['Polki', 5.5, 50.0, 0, 0, 5.5, 200.0])

    eme = wb.create_sheet('Eme')
    eme.append(['Particulars', 'Opening stock', None, 'Closing stock', None])
    eme.append([1, 'Qty', 'Amt.', 'Qty', 'Amt.'])
    eme.append(['JEM 100', 10, 20, 8, 999.5])

    # Financial statement — ignored.
    bs = wb.create_sheet('Balance Sheet')
    bs.append(['Particulars', 'Closing stock', None])
    bs.append(['Something', 1, 999999])

    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


class TestOpeningStockProductSheetMapping:
    def test_indexes_products_from_category_sheets_skips_totals(self):
        index = load_previous_year_product_sheets(
            _prev_year_category_workbook_bytes(),
            'prev.xlsx',
        )
        assert 'di. beads' in index
        assert index['di. beads']['closingStockAmount'] == 234713.15
        assert index['di. beads']['sheetName'] == 'Dia'
        assert index['polki']['closingStockAmount'] == 200.0
        assert index['jem 100']['closingStockAmount'] == 999.5
        assert 'total' not in index
        assert 'something' not in index  # balance sheet skipped

    def test_maps_qty_from_quantity_file_and_amount_from_closing_stock(self):
        sheets = load_previous_year_product_sheets(
            _prev_year_category_workbook_bytes(),
            'prev.xlsx',
        )
        result = validate_opening_stock(
            quantity_rows=[
                {'product': 'Di. beads', 'openingBalance': 263.03},
                {'product': 'Polki', 'openingBalance': 5.5},
                {'product': 'Emeralds JEM 100', 'openingBalance': 10},
            ],
            previous_year_sheets=sheets,
        )
        report = result['report']
        assert report['matchedCount'] == 3
        validated = {r['product']: r for r in result['validatedOpening']}
        assert validated['Di. beads']['openingQty'] == 263.03
        assert validated['Di. beads']['openingAmt'] == 234713.15
        assert validated['Polki']['openingAmt'] == 200.0
        assert validated['Emeralds JEM 100']['openingAmt'] == 999.5

    def test_unmatched_when_product_missing(self):
        sheets = load_previous_year_product_sheets(
            _prev_year_category_workbook_bytes(),
            'prev.xlsx',
        )
        result = validate_opening_stock(
            quantity_rows=[{'product': 'Missing Product', 'openingBalance': 3}],
            previous_year_sheets=sheets,
        )
        assert result['report']['matchedCount'] == 0
        assert result['report']['unmatchedCount'] == 1
        row = result['validatedOpening'][0]
        assert row['openingQty'] == 3
        assert row['openingAmt'] is None
        assert row['reason'] == 'product_sheet_not_found'

    def test_does_not_use_total_row_amount(self):
        sheets = load_previous_year_product_sheets(
            _prev_year_category_workbook_bytes(),
            'prev.xlsx',
        )
        # Di. Beads amount is product row, not TOTAL.
        assert sheets['di. beads']['closingStockAmount'] == 234713.15

    def test_maps_validated_opening_into_closing_stock_layout(self):
        opening_pivot = validated_opening_to_pivot(
            [
                {
                    'product': 'Product A',
                    'openingQty': 10.49,
                    'openingAmt': 100.49,
                    'status': 'matched',
                }
            ]
        )
        mapped = map_pivots_to_closing_stock_categories(
            sales_pivot=[],
            purchases_pivot=[],
            opening_pivot=opening_pivot,
            rule_book={
                'Diamond': {
                    'Diamonds - Beads': ['Product A'],
                    'Diamonds': [],
                },
                'Emerald': [],
                'Pearls': [],
                'Rubie': [],
                'Precious and Semi Precious': {
                    'Precious Stones': [],
                    'Semi Precious': [],
                    'Synthetic Stones': [],
                },
            },
        )
        product = next(
            row
            for row in mapped['layoutByCategory']['Diamond']
            if row.get('kind') == 'product' and row.get('label') == 'Product A'
        )
        assert product['openingQty'] == 10.49
        assert product['openingAmt'] == 100
        assert mapped['productsWithOpeningData'] == 1

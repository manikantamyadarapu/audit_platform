"""Closing Stock product Rule Book mapping tests."""

from __future__ import annotations

from io import BytesIO

from openpyxl import load_workbook

from app.engines.financials_engine.config.product_rule_book import (
    map_pivots_to_closing_stock_categories,
    map_product_names_to_categories,
)
from app.engines.financials_engine.engine.closing_stock_template import (
    CLOSING_STOCK_CATEGORIES,
    build_closing_stock_template_bytes,
)


SAMPLE_RULE_BOOK = {
    'Diamond': {
        'Diamonds - Beads': ['Product A'],
        'Diamonds': ['Product B'],
    },
    'Emerald': ['Product C'],
    'Pearls': ['Product D'],
    'Rubie': ['Product E'],
    'Precious and Semi Precious': {
        'Precious Stones': ['Product F'],
        'Semi Precious': ['Product G'],
        'Synthetic Stones': ['Product H'],
    },
}


class TestClosingStockProductRuleBook:
    def test_maps_products_to_correct_categories(self):
        mapped = map_product_names_to_categories(
            ['Product A', 'Product C', 'Product F', 'Unknown'],
            rule_book=SAMPLE_RULE_BOOK,
        )
        assert mapped['Diamond'] == ['Product A']
        assert mapped['Emerald'] == ['Product C']
        assert mapped['Precious and Semi Precious'] == ['Product F']
        assert mapped['Pearls'] == []
        assert mapped['Rubie'] == []

    def test_maps_pivot_qty_gross_and_builds_subcategory_layout(self):
        result = map_pivots_to_closing_stock_categories(
            sales_pivot=[
                {'product': 'Product A', 'sumOfQuantity': 2, 'sumOfGross': 100},
                {'product': 'Product C', 'sumOfQuantity': 1, 'sumOfGross': 50},
                {'product': 'Product F', 'sumOfQuantity': 4, 'sumOfGross': 40},
                {'product': 'Orphan', 'sumOfQuantity': 9, 'sumOfGross': 9},
            ],
            purchases_pivot=[
                {'product': 'Product B', 'sumOfQuantity': 3, 'sumOfGross': 30},
                {'product': 'Product A', 'sumOfQuantity': 1, 'sumOfGross': 10},
                {'product': 'Product G', 'sumOfQuantity': 2, 'sumOfGross': 20},
            ],
            rule_book=SAMPLE_RULE_BOOK,
        )

        assert result['productsByCategory']['Diamond'] == ['Product A', 'Product B']
        assert result['productsByCategory']['Emerald'] == ['Product C']
        assert result['productsByCategory']['Precious and Semi Precious'] == [
            'Product F',
            'Product G',
        ]
        assert result['unmappedProducts'] == ['Orphan']

        diamond_layout = result['layoutByCategory']['Diamond']
        assert [row['kind'] for row in diamond_layout] == [
            'subcategory',
            'product',
            'subcategory_total',
            'subcategory',
            'product',
            'subcategory_total',
            'grand_total',
        ]
        assert diamond_layout[0]['label'] == 'Diamonds - Beads'
        assert diamond_layout[2]['label'] == 'TOTAL'
        assert diamond_layout[-1]['label'] == 'GRAND TOTAL'

        precious_layout = result['layoutByCategory']['Precious and Semi Precious']
        total_labels = [
            row['label'] for row in precious_layout if row['kind'] == 'subcategory_total'
        ]
        assert total_labels == ['TOTAL - PRECIOUS STONES', 'TOTAL - SEMI PRECIOUS']

        emerald_layout = result['layoutByCategory']['Emerald']
        assert [row['kind'] for row in emerald_layout] == ['product', 'grand_total']

    def test_workbook_five_sheets_with_hierarchy(self):
        mapped = map_pivots_to_closing_stock_categories(
            sales_pivot=[
                {'product': 'Product A', 'sumOfQuantity': 1, 'sumOfGross': 1},
                {'product': 'Product C', 'sumOfQuantity': 1, 'sumOfGross': 1},
                {'product': 'Product D', 'sumOfQuantity': 1, 'sumOfGross': 1},
                {'product': 'Product F', 'sumOfQuantity': 1, 'sumOfGross': 1},
            ],
            purchases_pivot=[],
            rule_book=SAMPLE_RULE_BOOK,
        )
        raw = build_closing_stock_template_bytes(
            products_by_category=mapped['productsByCategory'],
            layout_by_category=mapped['layoutByCategory'],
        )
        wb = load_workbook(BytesIO(raw))
        assert wb.sheetnames == list(CLOSING_STOCK_CATEGORIES)

        diamond = wb['Diamond']
        assert diamond['A4'].value == 'DETAILS OF JEWELS CLOSING STOCK - DIAMOND'
        assert diamond.cell(row=10, column=1).value == 'Diamonds - Beads'
        assert diamond.cell(row=11, column=1).value == 'Product A'
        assert diamond.cell(row=12, column=1).value == 'TOTAL'
        assert str(diamond.cell(row=12, column=2).value).startswith('=SUM(')

        precious = wb['Precious and Semi Precious']
        assert (
            precious['A4'].value
            == 'DETAILS OF JEWELS CLOSING STOCK - PRECIOUS AND SEMI PRECIOUS'
        )
        assert precious.cell(row=10, column=1).value == 'Precious Stones'
        assert precious.cell(row=12, column=1).value == 'TOTAL - PRECIOUS STONES'

        emerald = wb['Emerald']
        assert emerald.cell(row=10, column=1).value == 'Product C'
        assert emerald.cell(row=11, column=1).value == 'GRAND TOTAL'

    def test_case_insensitive_rule_book_match(self):
        mapped = map_product_names_to_categories(
            ['product a', 'PRODUCT C'],
            rule_book=SAMPLE_RULE_BOOK,
        )
        assert mapped['Diamond'] == ['product a']
        assert mapped['Emerald'] == ['PRODUCT C']

    def test_punctuation_and_suffix_matching(self):
        result = map_pivots_to_closing_stock_categories(
            sales_pivot=[
                {'product': 'DI. RA 10', 'sumOfQuantity': 1, 'sumOfGross': 10},
                {'product': 'Emeralds JEM 100', 'sumOfQuantity': 2, 'sumOfGross': 20},
                {'product': 'Rubies JRU 100', 'sumOfQuantity': 3, 'sumOfGross': 30},
                {'product': 'Pearls JPS 100', 'sumOfQuantity': 1, 'sumOfGross': 5},
                {'product': 'Color Stones JOS 100', 'sumOfQuantity': 1, 'sumOfGross': 8},
            ],
            purchases_pivot=[
                {'product': 'Di. RC 1', 'sumOfQuantity': 4, 'sumOfGross': 40},
            ],
            rule_book={
                'Diamond': {
                    'Diamonds Rosecut diamonds': ['Di. RC 1'],
                    'Diamonds': ['Di. RA 10'],
                },
                'Emerald': ['JEM 100'],
                'Pearls': ['JPS 100'],
                'Rubie': ['JRU 100'],
                'Precious and Semi Precious': {
                    'Precious Stones': ['JOS 100'],
                    'Semi Precious': [],
                    'Synthetic Stones': [],
                },
            },
        )
        assert result['productsByCategory']['Diamond'] == ['Di. RC 1', 'DI. RA 10']
        assert result['productsByCategory']['Emerald'] == ['Emeralds JEM 100']
        assert result['productsByCategory']['Pearls'] == ['Pearls JPS 100']
        assert result['productsByCategory']['Rubie'] == ['Rubies JRU 100']
        assert result['productsByCategory']['Precious and Semi Precious'] == [
            'Color Stones JOS 100'
        ]
        assert result['unmappedProducts'] == []

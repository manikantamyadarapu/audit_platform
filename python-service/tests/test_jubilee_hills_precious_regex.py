"""Jubilee Hills Precious and Semi Precious products are placed by JOS, JSP, and JSY."""

from app.engines.financials_engine.config.product_rule_book import load_closing_stock_product_rule_book
from app.engines.financials_engine.engine.jubilee_hills_placement import (
    PRECIOUS_SHEET,
    jubilee_diamond_subcategory,
    jubilee_precious_subcategory,
    place_jubilee_hills_products,
)


CASES = [
    ('Precious stones JOS 100', 'Precious Stones'),
    ('  jos100  ', 'Precious Stones'),
    ('J.O.S 50', 'Precious Stones'),
    ('J-O-S Mix', 'Precious Stones'),
    ('J OS 10', 'Precious Stones'),
    ('Semi precious JSP 100', 'Semi Precious'),
    ('jsp1000', 'Semi Precious'),
    ('J.S.P 50', 'Semi Precious'),
    ('J SP 250', 'Semi Precious'),
    ('Synthetic JSY 100', 'Synthetic Stones'),
    ('jsy50', 'Synthetic Stones'),
    ('J.S.Y 300', 'Synthetic Stones'),
    ('Sythetic JSY 150', 'Synthetic Stones'),
]

NOT_PRECIOUS = [
    'JOSE',
    'JOSY',
    'AJOS',
    'JSPARK',
    'JPSY',
    'Pearls JPS 50',
    'Emeralds JEM 100',
    'Rubies JRU Mix',
    'Synthetic SYN 100',
    'Precious stones',
    'Semi precious',
    'Di. RA 10',
    'Chakri',
]


def _precious_rows(placed):
    return [
        row
        for row in placed['layoutByCategory'][PRECIOUS_SHEET]
        if row.get('kind') == 'product'
    ]


def test_precious_codes_assign_subcategory_and_keep_the_file_name():
    for name, subcategory in CASES:
        assert jubilee_precious_subcategory(name) == subcategory
        assert jubilee_diamond_subcategory(name) is None

    for name in NOT_PRECIOUS:
        assert jubilee_precious_subcategory(name) is None

    # JOS is listed before JSP and JSY.
    assert jubilee_precious_subcategory('JOS JSP JSY') == 'Precious Stones'


def test_matching_precious_products_land_on_one_sheet():
    for name, subcategory in CASES:
        placed = place_jubilee_hills_products(
            sales_pivot=[{'product': name, 'sumOfQuantity': 1, 'sumOfGross': 10}],
        )
        rows = _precious_rows(placed)
        assert len(rows) == 1, name
        assert rows[0]['label'] == name.strip()
        assert rows[0]['subcategory'] == subcategory
        assert name.strip() not in placed['unmappedProducts']
        for category, layout in placed['layoutByCategory'].items():
            if category == PRECIOUS_SHEET:
                continue
            assert [row for row in layout if row.get('kind') == 'product'] == []


def test_unrelated_names_are_not_forced_onto_precious():
    placed = place_jubilee_hills_products(
        sales_pivot=[
            {'product': name, 'sumOfQuantity': 1, 'sumOfGross': 10}
            for name in NOT_PRECIOUS
        ],
    )
    precious_labels = [row['label'] for row in _precious_rows(placed)]
    assert precious_labels == []
    assert 'Pearls JPS 50' in [
        row['label']
        for row in placed['layoutByCategory']['Pearls']
        if row.get('kind') == 'product'
    ]
    assert 'Di. RA 10' in [
        row['label']
        for row in placed['layoutByCategory']['Diamond']
        if row.get('kind') == 'product'
    ]


def test_rule_book_precious_names_follow_the_code_not_the_book():
    book = load_closing_stock_product_rule_book()
    expected = {
        'Precious Stones': 'Precious Stones',
        'Semi Precious': 'Semi Precious',
        'Synthetic Stones': 'Synthetic Stones',
    }
    for subcategory, names in book[PRECIOUS_SHEET].items():
        for name in names:
            assert jubilee_precious_subcategory(name) == expected[subcategory]
            placed = place_jubilee_hills_products(
                sales_pivot=[{'product': name, 'sumOfQuantity': 1, 'sumOfGross': 1}],
            )
            rows = _precious_rows(placed)
            assert len(rows) == 1
            assert rows[0]['label'] == name
            assert rows[0]['subcategory'] == expected[subcategory]


def test_zero_opening_only_precious_code_stays_off_the_sheet():
    placed = place_jubilee_hills_products(
        opening_pivot=[
            {'product': 'Precious stones JOS 100', 'sumOfQuantity': 0, 'sumOfGross': 0},
            {'product': 'Semi precious JSP 50', 'sumOfQuantity': 4, 'sumOfGross': 40},
        ],
    )
    rows = _precious_rows(placed)
    assert [row['label'] for row in rows] == ['Semi precious JSP 50']
    assert rows[0]['subcategory'] == 'Semi Precious'


def test_sales_and_purchases_of_the_same_precious_product_are_one_row():
    placed = place_jubilee_hills_products(
        sales_pivot=[{'product': 'Synthetic JSY 100', 'sumOfQuantity': 2, 'sumOfGross': 20}],
        purchases_pivot=[{'product': 'Synthetic JSY 100', 'sumOfQuantity': 5, 'sumOfGross': 50}],
    )
    rows = _precious_rows(placed)
    assert len(rows) == 1
    assert rows[0]['subcategory'] == 'Synthetic Stones'
    assert rows[0]['salesQty'] == 2
    assert rows[0]['purchasesQty'] == 5


def test_a_diamond_match_still_wins_over_a_precious_code():
    placed = place_jubilee_hills_products(
        sales_pivot=[{'product': 'Polki JOS 1', 'sumOfQuantity': 1, 'sumOfGross': 10}],
    )
    diamond_rows = [
        row
        for row in placed['layoutByCategory']['Diamond']
        if row.get('kind') == 'product'
    ]
    assert [row['label'] for row in diamond_rows] == ['Polki JOS 1']
    assert diamond_rows[0]['subcategory'] == 'Uncut - Diamonds'
    assert _precious_rows(placed) == []

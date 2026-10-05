"""Jubilee Hills Diamond products are placed by regex, not the Rule Book."""

from app.engines.financials_engine.config.product_rule_book import load_closing_stock_product_rule_book
from app.engines.financials_engine.engine.jubilee_hills_placement import (
    DIAMOND_SHEET,
    jubilee_diamond_subcategory,
    place_jubilee_hills_products,
)


CASES = [
    ('Chakri', 'Uncut - Diamonds'),
    ('Customer Flat Polki', 'Diamonds - Flat Polki'),
    ('  polki  ', 'Uncut - Diamonds'),
    ('Uncut-Polki', 'Uncut - Diamonds'),
    ('Flat polki FP 1', 'Diamonds - Flat Polki'),
    ('F.P 12', 'Diamonds - Flat Polki'),
    ('fp1', 'Diamonds - Flat Polki'),
    ('BD 100', 'Diamonds - Black Diamonds'),
    ('B-D Mix', 'Diamonds - Black Diamonds'),
    ('Black Diamonds', 'Diamonds - Black Diamonds'),
    ('black   diamonds', 'Diamonds - Black Diamonds'),
    ('Black-Diamonds Loose', 'Diamonds - Black Diamonds'),
    ('DB 10', 'Diamonds - Beads'),
    ('Di. DB 5', 'Diamonds - Beads'),
    ('Di. Beads', 'Diamonds - Beads'),
    ('di. beads', 'Diamonds - Beads'),
    ('DI. BEADS', 'Diamonds - Beads'),
    ('Di Beads', 'Diamonds - Beads'),
    ('Di.Beads', 'Diamonds - Beads'),
    ('RC 3', 'Diamonds - Rosecut Diamonds'),
    ('Di. RC 1', 'Diamonds - Rosecut Diamonds'),
    ('Di. RA 100', 'Diamonds'),
    ('RA10', 'Diamonds'),
    ('Diamonds Loose Di. SD 250', 'Diamonds'),
    ('SD Di. Mix', 'Diamonds'),
    ('S.D 225', 'Diamonds'),
]

NOT_DIAMOND = [
    'Black Daimononds',
    'Chakrika',
    'Polkish',
    'BODY',
    'DATABASE',
    'RECORD',
    'STANDARD GOLD',
    'Customer Diamonds',
    'Beads',
    'Diamond Beads',
    'Emeralds JEM 100',
    'Pearls JPS 50',
    'Rubies JRU Mix',
    'Opening Only Dia',
]


def _diamond_rows(placed):
    return [
        row
        for row in placed['layoutByCategory'][DIAMOND_SHEET]
        if row.get('kind') == 'product'
    ]


def test_diamond_regex_assigns_subcategory_and_keeps_the_file_name():
    for name, subcategory in CASES:
        assert jubilee_diamond_subcategory(name) == subcategory

    for name in NOT_DIAMOND:
        assert jubilee_diamond_subcategory(name) is None

    # FP and the words Flat Polki are more specific than the Polki word.
    assert jubilee_diamond_subcategory('Polki FP 2') == 'Diamonds - Flat Polki'
    assert jubilee_diamond_subcategory('Customer Flat Polki') == 'Diamonds - Flat Polki'
    assert jubilee_diamond_subcategory('polki') == 'Uncut - Diamonds'
    # A code wins over a less specific word when both are present.
    assert jubilee_diamond_subcategory('Chakri DB 1') == 'Diamonds - Beads'


def test_matching_diamond_products_land_on_the_diamond_sheet_only():
    for name, subcategory in CASES:
        placed = place_jubilee_hills_products(
            sales_pivot=[{'product': name, 'sumOfQuantity': 1, 'sumOfGross': 10}],
            purchases_pivot=[],
            opening_pivot=[],
        )
        rows = _diamond_rows(placed)
        assert len(rows) == 1, name
        assert rows[0]['label'] == name.strip()
        assert rows[0]['subcategory'] == subcategory
        assert name.strip() not in placed['unmappedProducts']
        for category, layout in placed['layoutByCategory'].items():
            if category == DIAMOND_SHEET:
                continue
            assert [row for row in layout if row.get('kind') == 'product'] == []


def test_non_matching_names_are_not_forced_onto_diamond():
    placed = place_jubilee_hills_products(
        sales_pivot=[
            {'product': name, 'sumOfQuantity': 1, 'sumOfGross': 10}
            for name in NOT_DIAMOND
            if name != 'Opening Only Dia'
        ],
        opening_pivot=[
            {
                'product': 'Opening Only Dia',
                'sumOfQuantity': 4,
                'sumOfGross': 40,
                'sheetName': 'Dia',
                'category': 'Dia',
            },
            {
                'product': 'Chakri Opening',
                'sumOfQuantity': 2,
                'sumOfGross': 20,
                'sheetName': 'Emerald',
            },
        ],
    )
    diamond_labels = [row['label'] for row in _diamond_rows(placed)]
    for name in NOT_DIAMOND:
        assert name not in diamond_labels
    assert 'Chakri Opening' in diamond_labels
    chakri = next(row for row in _diamond_rows(placed) if row['label'] == 'Chakri Opening')
    assert chakri['subcategory'] == 'Uncut - Diamonds'


def test_rule_book_does_not_place_a_diamond_name_without_a_code():
    book = load_closing_stock_product_rule_book()
    rule_names = []
    for products in book['Diamond'].values():
        rule_names.extend(products)

    placed = place_jubilee_hills_products(
        sales_pivot=[{'product': name, 'sumOfQuantity': 1, 'sumOfGross': 1} for name in rule_names]
    )
    labels = {row['label'] for row in _diamond_rows(placed)}
    assert 'Di. Beads' in labels
    beads = next(row for row in _diamond_rows(placed) if row['label'] == 'Di. Beads')
    assert beads['subcategory'] == 'Diamonds - Beads'
    assert 'Di. RC 1' in labels
    assert 'Flat polki FP 1' in labels
    assert 'Chakri' in labels
    assert 'Di. RA 10' in labels
    assert 'SD Di. 225' in labels
    for name in rule_names:
        if jubilee_diamond_subcategory(name):
            assert name in labels
        else:
            assert name not in labels


def test_zero_opening_only_diamond_stays_off_the_sheet():
    placed = place_jubilee_hills_products(
        sales_pivot=[],
        purchases_pivot=[],
        opening_pivot=[
            {'product': 'Flat polki FP 1', 'sumOfQuantity': 0, 'sumOfGross': 0},
            {'product': 'Chakri', 'sumOfQuantity': None, 'sumOfGross': None},
            {'product': 'Di. RA 10', 'sumOfQuantity': 3, 'sumOfGross': 30},
        ],
    )
    labels = [row['label'] for row in _diamond_rows(placed)]
    assert labels == ['Di. RA 10']
    assert _diamond_rows(placed)[0]['subcategory'] == 'Diamonds'


def test_sales_and_purchases_of_the_same_diamond_product_are_one_row():
    placed = place_jubilee_hills_products(
        sales_pivot=[{'product': 'Di. SD 250', 'sumOfQuantity': 2, 'sumOfGross': 20}],
        purchases_pivot=[{'product': 'Di. SD 250', 'sumOfQuantity': 5, 'sumOfGross': 50}],
    )
    rows = _diamond_rows(placed)
    assert len(rows) == 1
    assert rows[0]['label'] == 'Di. SD 250'
    assert rows[0]['subcategory'] == 'Diamonds'
    assert rows[0]['salesQty'] == 2
    assert rows[0]['purchasesQty'] == 5

"""Jubilee Hills places products by name code, saved mapping, or previous-year sheet."""

from app.engines.financials_engine.config.product_rule_book import CLOSING_STOCK_CATEGORIES
from app.engines.financials_engine.engine.jubilee_hills_placement import place_jubilee_hills_products


def _product_labels(placed, category):
    return [
        row['label']
        for row in placed['layoutByCategory'][category]
        if row.get('kind') == 'product'
    ]


def _all_product_labels(placed):
    labels = []
    for category in CLOSING_STOCK_CATEGORIES:
        labels.extend(_product_labels(placed, category))
    return labels


def test_jubilee_hills_product_flow():
    placed = place_jubilee_hills_products(
        sales_pivot=[
            {'product': 'Di. Beads', 'sumOfQuantity': 2, 'sumOfGross': 100},
            {'product': 'Emeralds JEM 100', 'sumOfQuantity': 1, 'sumOfGross': 10},
            {'product': 'JPS 50', 'sumOfQuantity': 3, 'sumOfGross': 30},
        ],
        purchases_pivot=[
            {'product': 'Di. Beads', 'sumOfQuantity': 4, 'sumOfGross': 40},
            {'product': 'jem100', 'sumOfQuantity': 5, 'sumOfGross': 50},
            {'product': 'Rubie JRU 10', 'sumOfQuantity': 6, 'sumOfGross': 60},
        ],
        opening_pivot=[
            {
                'product': 'Emeralds JEM 100',
                'sumOfQuantity': 7,
                'sumOfGross': 70,
                'sheetName': 'Dia',
            },
            {
                'product': 'Opening Only Dia',
                'sumOfQuantity': 8,
                'sumOfGross': 80,
                'category': 'Dia',
                'sheetName': 'Dia',
            },
            {
                'product': 'JEM Zero Opening',
                'sumOfQuantity': 0,
                'sumOfGross': 0,
                'sheetName': 'Dia',
            },
            {
                'product': 'Blank Opening',
                'sumOfQuantity': None,
                'sheetName': 'Rubi',
            },
        ],
    )

    labels = _all_product_labels(placed)
    assert 'Di. Beads' in _product_labels(placed, 'Diamond')
    assert 'Di. Beads' not in placed['unmappedProducts']
    beads = next(
        row
        for row in placed['layoutByCategory']['Diamond']
        if row.get('label') == 'Di. Beads'
    )
    assert beads['subcategory'] == 'Diamonds - Beads'
    assert beads['salesQty'] == 2
    assert beads['purchasesQty'] == 4
    assert 'Emeralds JEM 100' in _product_labels(placed, 'Emerald')
    assert 'Emeralds JEM 100' not in _product_labels(placed, 'Diamond')
    assert 'JPS 50' in _product_labels(placed, 'Pearls')
    assert 'Rubie JRU 10' in _product_labels(placed, 'Rubie')
    assert 'jem100' not in labels
    assert labels.count('Emeralds JEM 100') == 1
    assert 'Opening Only Dia' not in _product_labels(placed, 'Diamond')
    assert 'Opening Only Dia' in placed['unmappedProducts']
    assert 'JEM Zero Opening' not in labels
    assert 'Blank Opening' not in labels
    assert 'JEM Zero Opening' not in placed['unmappedProducts']
    assert 'Blank Opening' not in placed['unmappedProducts']

    jem_row = next(
        row
        for row in placed['layoutByCategory']['Emerald']
        if row.get('label') == 'Emeralds JEM 100'
    )
    assert jem_row['salesQty'] == 1
    assert jem_row['purchasesQty'] == 5
    assert jem_row['openingQty'] == 7

    resolved = {row['product']: row for row in placed['resolvedMappings']}
    assert 'Emeralds JEM 100' not in resolved
    assert 'Opening Only Dia' not in resolved

    mapped = place_jubilee_hills_products(
        sales_pivot=[{'product': 'ZZ Unknown Sale Stone', 'sumOfQuantity': 1, 'sumOfGross': 10}],
        purchases_pivot=[{'product': 'ZZ Unknown Sale Stone', 'sumOfQuantity': 4, 'sumOfGross': 40}],
        opening_pivot=[
            {
                'product': 'Opening Only Dia',
                'sumOfQuantity': 8,
                'sumOfGross': 80,
                'sheetName': 'Dia',
            }
        ],
    )
    assert 'ZZ Unknown Sale Stone' not in _all_product_labels(mapped)
    assert 'ZZ Unknown Sale Stone' in mapped['unmappedProducts']
    assert 'Opening Only Dia' not in _product_labels(mapped, 'Diamond')
    assert 'Opening Only Dia' in mapped['unmappedProducts']


def test_mr_or_dc_only_product_uses_location_net():
    placed = place_jubilee_hills_products(
        sales_pivot=[{'product': 'Di. Beads', 'sumOfQuantity': 2, 'sumOfGross': 100}],
        purchases_pivot=[],
        opening_pivot=[{'product': 'Emeralds JEM 100', 'sumOfQuantity': 0, 'sumOfGross': 0}],
        mr_pivots={
            'jubileeHills': [
                {'product': 'Di. RC 9', 'sumOfQuantity': 4, 'sumOfGross': 1},
                {'product': 'Di. Beads', 'sumOfQuantity': 8, 'sumOfGross': 1},
            ],
        },
        dc_pivots={
            'kokapet': [
                {'product': 'Plain Finding', 'sumOfQuantity': 1, 'sumOfGross': 1},
                {'product': 'Emeralds JEM 100', 'sumOfQuantity': 3, 'sumOfGross': 1},
            ],
        },
    )
    labels = _all_product_labels(placed)
    assert labels.count('Di. Beads') == 1
    assert 'Di. RC 9' in labels
    assert 'Emeralds JEM 100' in labels
    assert 'Plain Finding' in placed['unmappedProducts']
    rc_row = next(
        row
        for row in placed['layoutByCategory']['Diamond']
        if row.get('label') == 'Di. RC 9'
    )
    assert rc_row.get('salesQty') in (None, 0)
    assert rc_row.get('purchasesQty') in (None, 0)
    assert rc_row.get('openingQty') in (None, 0)
    assert rc_row.get('receiptsJubileeHillsQty') == 4
    assert rc_row.get('receiptsJubileeHillsAmt') is None
    assert rc_row.get('issuesBanjaraHillsQty') in (None, 0)
    beads = next(
        row
        for row in placed['layoutByCategory']['Diamond']
        if row.get('label') == 'Di. Beads'
    )
    assert beads.get('receiptsJubileeHillsQty') == 8
    assert beads.get('receiptsJubileeHillsAmt') is None
    emerald = next(
        row
        for row in placed['layoutByCategory']['Emerald']
        if row.get('label') == 'Emeralds JEM 100'
    )
    assert emerald.get('issuesKokapetQty') == 3
    assert emerald.get('receiptsKokapetQty') in (None, 0)


def test_mr_dc_net_sign_chooses_receipts_or_issues_and_ignores_gross():
    placed = place_jubilee_hills_products(
        sales_pivot=[],
        purchases_pivot=[],
        opening_pivot=[
            {'product': 'Di. RA 10', 'sumOfQuantity': 10, 'sumOfGross': 100},
        ],
        mr_pivots={
            'jubileeHills': [
                {'product': 'Di. RA 10', 'sumOfQuantity': 1, 'sumOfGross': 999},
                {'product': 'Di. SD 1', 'sumOfQuantity': 1, 'sumOfGross': 999},
            ],
            'internalBasheerbagh': [{'product': 'Di. SD 1', 'sumOfQuantity': 6, 'sumOfGross': 999}],
        },
        dc_pivots={
            'jubileeHills': [{'product': 'di. ra 10', 'sumOfQuantity': 5, 'sumOfGross': 999}],
            'internalBasheerbagh': [{'product': 'Di. SD 1', 'sumOfQuantity': 2, 'sumOfGross': 999}],
        },
    )
    ra = next(row for row in placed['layoutByCategory']['Diamond'] if row.get('label') == 'Di. RA 10')
    sd = next(row for row in placed['layoutByCategory']['Diamond'] if row.get('label') == 'Di. SD 1')
    assert ra.get('issuesBanjaraHillsQty') == 4
    assert ra.get('receiptsJubileeHillsQty') in (None, 0)
    assert ra.get('receiptsJubileeHillsAmt') is None
    assert ra.get('issuesBanjaraHillsAmt') == 40
    assert sd.get('receiptsJubileeHillsQty') == 5
    assert sd.get('receiptsInternalQty') in (None, 0)
    assert sd.get('issuesInternalQty') in (None, 0)
    assert sd.get('receiptsJubileeHillsAmt') is None

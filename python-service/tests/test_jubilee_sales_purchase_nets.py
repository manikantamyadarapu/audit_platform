"""Jubilee Hills net sales and net purchases from the six product pivots."""

from app.engines.financials_engine.engine.jubilee_sales_purchase_nets import (
    build_jubilee_sales_purchase_nets,
)


def test_loose_variants_share_one_net_row_and_every_input_is_accounted():
    result = build_jubilee_sales_purchase_nets(
        sales_pivot=[{'product': 'DI RA 10', 'sumOfQuantity': 5, 'sumOfGross': 50}],
        purchases_pivot=[{'product': 'DI RA 10', 'sumOfQuantity': 4, 'sumOfGross': 40}],
        sales_return_pivot=[
            {'product': 'DI RA LOOSE 10', 'sumOfQuantity': 1, 'sumOfGross': 10},
            {'product': 'Return Only RC 1', 'sumOfQuantity': 2, 'sumOfGross': 20},
        ],
        purchase_return_pivot=[
            {'product': 'DI. RA. 10', 'sumOfQuantity': 1, 'sumOfGross': 8},
        ],
        debit_note_pivot=[{'product': 'Debit Only JEM 1', 'sumOfQuantity': 0, 'sumOfGross': 15}],
        credit_note_pivot=[{'product': 'DI RA LOOSE 10', 'sumOfQuantity': 0, 'sumOfGross': 5}],
    )
    products = {row['product']: row for row in result['report']['products']}
    assert list(products) == ['DI RA 10', 'Return Only RC 1', 'Debit Only JEM 1']
    assert products['DI RA 10']['netSalesQty'] == 4.0
    assert products['DI RA 10']['netSalesAmount'] == 40.0
    assert products['DI RA 10']['netPurchaseQty'] == 3.0
    assert products['DI RA 10']['netPurchaseAmount'] == 27.0
    assert products['Return Only RC 1']['netSalesQty'] == -2.0
    assert products['Return Only RC 1']['netPurchaseQty'] is None
    assert products['Debit Only JEM 1']['netPurchaseAmount'] == 15.0
    assert products['Debit Only JEM 1']['netSalesQty'] is None
    assert result['report']['unaccountedProducts'] == []
    assert result['report']['inputProductCount'] == result['report']['accountedProductCount'] == 3
    assert [row['product'] for row in result['netSalesPivot']] == ['DI RA 10', 'Return Only RC 1']
    assert [row['product'] for row in result['netPurchasesPivot']] == [
        'DI RA 10',
        'Debit Only JEM 1',
    ]


def test_short_code_return_reduces_the_full_product_name():
    result = build_jubilee_sales_purchase_nets(
        sales_pivot=[{'product': 'Emeralds JEM 100', 'sumOfQuantity': 4, 'sumOfGross': 400}],
        purchases_pivot=[{'product': 'Flat Polki FP 1', 'sumOfQuantity': 8, 'sumOfGross': 800}],
        sales_return_pivot=[{'product': 'JEM 100', 'sumOfQuantity': 1, 'sumOfGross': 50}],
        purchase_return_pivot=[{'product': 'FP 1', 'sumOfQuantity': 2, 'sumOfGross': 100}],
        debit_note_pivot=[{'product': 'Flat Polki FP 1', 'sumOfQuantity': 0, 'sumOfGross': 20}],
        credit_note_pivot=[{'product': 'FP 1', 'sumOfQuantity': 0, 'sumOfGross': 40}],
    )
    products = {row['product']: row for row in result['report']['products']}
    assert list(products) == ['Emeralds JEM 100', 'Flat Polki FP 1']
    assert products['Emeralds JEM 100']['netSalesQty'] == 3.0
    assert products['Emeralds JEM 100']['netSalesAmount'] == 350.0
    assert products['Flat Polki FP 1']['netPurchaseQty'] == 6.0
    assert products['Flat Polki FP 1']['netPurchaseAmount'] == 680.0
    assert result['report']['unaccountedProducts'] == []

    from app.engines.financials_engine.engine.jubilee_hills_placement import place_jubilee_hills_products

    placed = place_jubilee_hills_products(
        sales_pivot=result['netSalesPivot'],
        purchases_pivot=result['netPurchasesPivot'],
    )
    emerald = next(
        row
        for row in placed['layoutByCategory']['Emerald']
        if row.get('kind') == 'product'
    )
    flat = next(
        row
        for row in placed['layoutByCategory']['Diamond']
        if row.get('kind') == 'product' and row.get('label') == 'Flat Polki FP 1'
    )
    assert emerald['label'] == 'Emeralds JEM 100'
    assert emerald['salesQty'] == 3.0
    assert emerald['salesAmt'] == 350.0
    assert flat['subcategory'] == 'Diamonds - Flat Polki'
    assert flat['purchasesQty'] == 6.0
    assert flat['purchasesAmt'] == 680.0


def test_distinct_codes_are_not_merged():
    result = build_jubilee_sales_purchase_nets(
        sales_pivot=[
            {'product': 'DI RA 10', 'sumOfQuantity': 1, 'sumOfGross': 10},
            {'product': 'DI RA 100', 'sumOfQuantity': 2, 'sumOfGross': 20},
            {'product': 'DI RB 10', 'sumOfQuantity': 3, 'sumOfGross': 30},
            {'product': 'DI RA LOOSELY 10', 'sumOfQuantity': 4, 'sumOfGross': 40},
        ],
    )
    assert [row['product'] for row in result['report']['products']] == [
        'DI RA 10',
        'DI RA 100',
        'DI RB 10',
        'DI RA LOOSELY 10',
    ]
    assert result['report']['unaccountedProducts'] == []

"""Receipt amount is receipt quantity times the source branch average rate."""

from app.engines.financials_engine.engine.receipt_amounts import (
    apply_source_receipt_amounts,
    receipt_source_branch,
)


def _layout(product, **measures):
    row = {
        'kind': 'product',
        'label': product,
        'subcategory': 'Diamonds',
        'openingQty': None,
        'openingAmt': None,
        'purchasesQty': None,
        'purchasesAmt': None,
        'salesQty': None,
        'salesAmt': None,
        'receiptsInternalQty': None,
        'receiptsJubileeHillsQty': None,
        'receiptsKokapetQty': None,
        'issuesInternalQty': None,
        'issuesBanjaraHillsQty': None,
        'issuesKokapetQty': None,
        'totalQty': None,
        'totalAmt': None,
    }
    row.update(measures)
    return {
        'Diamond': [
            row,
            {'kind': 'grand_total', 'label': 'GRAND TOTAL', 'subcategory': None},
        ]
    }


def _product(layout):
    return next(row for row in layout['Diamond'] if row.get('kind') == 'product')


def test_source_branch_for_each_receipt_column():
    assert receipt_source_branch('basheerbagh', 'receiptsJubileeHillsQty') == 'jubileeHills'
    assert receipt_source_branch('basheerbagh', 'receiptsKokapetQty') == 'kokapet'
    assert receipt_source_branch('basheerbagh', 'receiptsInternalQty') == 'basheerbagh'
    assert receipt_source_branch('kokapet', 'receiptsInternalQty') == 'basheerbagh'
    assert receipt_source_branch('jubileeHills', 'receiptsInternalQty') == 'jubileeHills'
    assert receipt_source_branch('jubileeHills', 'receiptsJubileeHillsQty') == 'basheerbagh'
    assert receipt_source_branch('jubileeHills', 'receiptsKokapetQty') == 'kokapet'


def test_kokapet_receipt_uses_kokapet_rate_not_destination_or_gross():
    layout = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        receiptsKokapetQty=2,
        totalQty=6,
        totalAmt=40,
    )
    applied = apply_source_receipt_amounts(
        layout,
        destination='basheerbagh',
        source_average_rates={
            'kokapet': [{'product': 'DI RA LOOSE 10', 'averageRateAmt': 5}],
            'jubileeHills': [{'product': 'Other Product', 'averageRateAmt': 99}],
        },
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsKokapetQty'] == 2
    assert row['receiptsKokapetAmt'] == 10
    assert row['receiptsAmt'] == 10
    assert row['totalAmt'] == 50
    assert applied['receiptAmountReview'] == []


def test_missing_source_rate_is_flagged_and_amount_stays_blank():
    layout = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        receiptsJubileeHillsQty=3,
        totalQty=7,
        totalAmt=40,
    )
    applied = apply_source_receipt_amounts(
        layout,
        destination='basheerbagh',
        source_average_rates={'jubileeHills': [{'product': 'Di. SD 1', 'averageRateAmt': 8}]},
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsJubileeHillsQty'] == 3
    assert row['receiptsJubileeHillsAmt'] is None
    assert row['receiptsAmt'] is None
    assert applied['receiptAmountReview'][0]['product'] == 'Di. RA 10'
    assert applied['receiptAmountReview'][0]['sourceBranch'] == 'jubileeHills'


def test_jubilee_basheerbagh_receipt_uses_basheerbagh_rate():
    layout = _layout(
        'Di. RC 10',
        openingQty=1,
        openingAmt=100,
        receiptsJubileeHillsQty=2,
        totalQty=3,
        totalAmt=100,
    )
    applied = apply_source_receipt_amounts(
        layout,
        destination='jubileeHills',
        source_average_rates={
            'basheerbagh': [{'product': 'Di. RC 10', 'category': 'Diamond', 'averageRateAmt': 25000}],
            'jubileeHills': [{'product': 'Di. RC 10', 'category': 'Diamond', 'averageRateAmt': 100}],
        },
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsJubileeHillsQty'] == 2
    assert row['receiptsJubileeHillsAmt'] == 50000
    assert row['receiptsAmt'] == 50000
    assert applied['receiptAmountReview'] == []


def test_manual_mapping_uses_the_chosen_source_product_rate():
    layout = _layout(
        'Di. RC 10',
        openingQty=1,
        openingAmt=100,
        receiptsJubileeHillsQty=2,
        totalQty=3,
        totalAmt=100,
    )
    rates = {
        'basheerbagh': [{'product': 'Rose Cut RC 10', 'averageRateAmt': 25000}],
    }
    missing = apply_source_receipt_amounts(
        layout,
        destination='jubileeHills',
        source_average_rates=rates,
    )
    assert _product(missing['layoutByCategory'])['receiptsJubileeHillsAmt'] is None
    assert missing['receiptAmountReview']

    applied = apply_source_receipt_amounts(
        layout,
        destination='jubileeHills',
        source_average_rates=rates,
        receipt_rate_mappings=[
            {
                'product': 'Di. RC 10',
                'category': 'Diamond',
                'sourceBranch': 'basheerbagh',
                'sourceProduct': 'Rose Cut RC 10',
                'averageRateAmt': 25000,
            }
        ],
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsJubileeHillsAmt'] == 50000
    assert applied['receiptAmountReview'] == []


def test_internal_receipt_on_basheerbagh_uses_that_products_own_rate():
    layout = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        receiptsInternalQty=2,
        totalQty=6,
        totalAmt=40,
    )
    applied = apply_source_receipt_amounts(layout, destination='basheerbagh')
    row = _product(applied['layoutByCategory'])
    assert row['receiptsInternalQty'] == 2
    assert row['averageRateAmt'] == 10
    assert row['receiptsInternalAmt'] == 20
    assert row['receiptsAmt'] == 20

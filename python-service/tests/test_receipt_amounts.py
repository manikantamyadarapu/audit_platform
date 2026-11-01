"""Receipt amount is receipt quantity times the source branch average rate."""

from app.engines.financials_engine.engine.receipt_amounts import (
    apply_source_issue_receipts,
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
    assert receipt_source_branch('kokapet', 'receiptsInternalQty') == 'kokapet'
    assert receipt_source_branch('kokapet', 'receiptsKokapetQty') == 'basheerbagh'
    assert receipt_source_branch('kokapet', 'receiptsJubileeHillsQty') == 'jubileeHills'
    assert receipt_source_branch('jubileeHills', 'receiptsInternalQty') == 'jubileeHills'
    assert receipt_source_branch('jubileeHills', 'receiptsKokapetQty') == 'kokapet'
    assert receipt_source_branch('jubileeHills', 'receiptsJubileeHillsQty') == 'basheerbagh'
    assert receipt_source_branch('jubilee-hills', 'receiptsKokapetQty') == 'kokapet'


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


def test_manual_receipt_rate_mapping_fills_amount():
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
            'kokapet': [{'product': 'Kokapet RA 10', 'averageRateAmt': 7}],
        },
        receipt_rate_mappings=[
            {
                'product': 'Di. RA 10',
                'category': 'Diamond',
                'sourceBranch': 'kokapet',
                'sourceProduct': 'Kokapet RA 10',
                'averageRateAmt': 7,
            }
        ],
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsKokapetAmt'] == 14
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


def test_basheerbagh_jubilee_hills_receipt_fills_from_jubilee_rate():
    layout = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        receiptsJubileeHillsQty=2,
        totalQty=6,
        totalAmt=40,
    )
    applied = apply_source_receipt_amounts(
        layout,
        destination='basheerbagh',
        source_average_rates={'jubileeHills': [{'product': 'Di. RA 10', 'averageRateAmt': 9}]},
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsJubileeHillsQty'] == 2
    assert row['receiptsJubileeHillsAmt'] == 18
    assert applied['receiptAmountReview'] == []


def test_existing_receipt_amount_is_kept_when_source_rate_is_missing():
    layout = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        receiptsJubileeHillsQty=2,
        receiptsJubileeHillsAmt=18,
        totalQty=6,
        totalAmt=58,
    )
    applied = apply_source_receipt_amounts(layout, destination='basheerbagh')
    row = _product(applied['layoutByCategory'])
    assert row['receiptsJubileeHillsAmt'] == 18


def test_jubilee_hills_kokapet_receipt_fills_from_kokapet_rate():
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
        destination='jubilee-hills',
        source_average_rates={'kokapet': [{'product': 'Di. RA 10', 'averageRateAmt': 7}]},
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsKokapetQty'] == 2
    assert row['receiptsKokapetAmt'] == 14
    assert applied['receiptAmountReview'] == []


def test_jubilee_hills_basheerbagh_receipt_uses_basheerbagh_rate():
    layout = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        receiptsJubileeHillsQty=2,
        totalQty=6,
        totalAmt=40,
    )
    applied = apply_source_receipt_amounts(
        layout,
        destination='jubileeHills',
        source_average_rates={'basheerbagh': [{'product': 'Di. RA 10', 'averageRateAmt': 11}]},
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsJubileeHillsAmt'] == 22


def test_basheerbagh_issues_drop_onto_jubilee_hills_receipts_after_opening_mapping():
    dest = _layout('Di. RA 10', receiptsJubileeHillsQty=9, receiptsJubileeHillsAmt=1)
    source = _layout(
        'Di. RA 10',
        issuesBanjaraHillsQty=3,
        issuesBanjaraHillsAmt=33,
    )
    dropped, review = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    row = _product(dropped)
    assert row['receiptsJubileeHillsQty'] == 3
    assert row['receiptsJubileeHillsAmt'] == 1
    assert review[0]['status'] == 'quantityMismatch'
    assert review[0]['authoritativeReceiptQty'] == 3


def test_independent_product_drops_while_other_opening_mapping_is_pending():
    dest = _layout('Di. RA 10', receiptsJubileeHillsQty=9)
    source = _layout('Di. RA 10', issuesBanjaraHillsQty=3, issuesBanjaraHillsAmt=33)
    dropped, _review = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': False},
        source_opening_pending={'basheerbagh': ['Pending Gold']},
    )
    row = _product(dropped)
    assert row['receiptsJubileeHillsQty'] == 3


def test_issues_do_not_drop_while_source_opening_mapping_is_pending():
    dest = _layout('Di. RA 10', receiptsJubileeHillsQty=9)
    source = _layout('Di. RA 10', issuesBanjaraHillsQty=3, issuesBanjaraHillsAmt=33)
    dropped, _review = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': False},
        source_opening_pending={'basheerbagh': ['Di. RA 10']},
    )
    row = _product(dropped)
    assert row['receiptsJubileeHillsQty'] == 9


def test_product_with_other_receipts_waits_until_source_mapping_is_done():
    dest = _layout('Di. RA 10', receiptsJubileeHillsQty=9, receiptsKokapetQty=2)
    source = _layout(
        'Di. RA 10',
        issuesBanjaraHillsQty=3,
        issuesBanjaraHillsAmt=33,
        receiptsKokapetQty=1,
    )
    waiting, _review = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': False},
        source_opening_pending={'basheerbagh': []},
    )
    assert _product(waiting)['receiptsJubileeHillsQty'] == 9
    dropped, _done = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
        source_opening_pending={'basheerbagh': []},
    )
    assert _product(dropped)['receiptsJubileeHillsQty'] == 3


def test_issue_drop_uses_manual_product_mapping():
    dest = _layout('Di. RA 10', receiptsKokapetQty=1)
    source = _layout('Kokapet RA 10', issuesBanjaraHillsQty=4, issuesBanjaraHillsAmt=40)
    dropped, _review = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'kokapet': source},
        source_opening_complete={'kokapet': True},
        receipt_rate_mappings=[
            {
                'product': 'Di. RA 10',
                'category': 'Diamond',
                'sourceBranch': 'kokapet',
                'sourceProduct': 'Kokapet RA 10',
            }
        ],
    )
    row = _product(dropped)
    assert row['receiptsKokapetQty'] == 4
    assert row['receiptsJubileeHillsQty'] in (None, 1)

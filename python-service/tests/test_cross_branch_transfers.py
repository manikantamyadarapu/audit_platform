"""Source Issue Quantity is the destination Receipt Quantity."""

from app.engines.financials_engine.engine.cross_branch_transfers import (
    TRANSFER_DIRECTION_LOCATIONS,
    aggregate_transfer_lines,
)
from app.engines.financials_engine.engine.receipt_amounts import (
    apply_source_issue_receipts,
    apply_source_receipt_amounts,
)
from tests.test_receipt_amounts import _layout, _product


def test_basheerbagh_to_kokapet_matched_receipt_uses_source_issue():
    dest = _layout('Di. RA 10', receiptsKokapetQty=100)
    source = _layout('Di. RA 10', issuesKokapetQty=100, issuesKokapetAmt=1000)
    dropped, review = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    row = _product(dropped)
    assert row['receiptsKokapetQty'] == 100
    assert review[0]['status'] == 'matched'
    assert review[0]['difference'] == 0.0


def test_quantity_mismatch_keeps_source_issue_and_flags_difference():
    dest = _layout('Di. RA 10', receiptsKokapetQty=95)
    source = _layout('Di. RA 10', issuesKokapetQty=100)
    dropped, review = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    row = _product(dropped)
    assert row['receiptsKokapetQty'] == 100
    assert review[0]['status'] == 'quantityMismatch'
    assert review[0]['difference'] == 5
    assert review[0]['destinationMrQty'] == 95


def test_different_party_names_do_not_block_receipt_qty():
    dest = _layout('Di. RA 10', receiptsKokapetQty=150)
    source = _layout('Di. RA 10', issuesKokapetQty=150)
    dropped, review = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
        source_transfer_lines={
            'basheerbagh': {
                'dc': [
                    {
                        'location': 'kokapet',
                        'party': 'Sender Party',
                        'product': 'Di. RA 10',
                        'quantity': 150,
                    }
                ]
            }
        },
        destination_transfer_lines={
            'mr': [
                {
                    'location': 'kokapet',
                    'party': 'Receiver Party',
                    'product': 'Di. RA 10',
                    'quantity': 150,
                }
            ]
        },
    )
    assert _product(dropped)['receiptsKokapetQty'] == 150
    assert review[0]['status'] == 'matched'
    assert 'Sender Party' in review[0]['party']
    assert 'Receiver Party' in review[0]['party']


def test_different_products_match_independently():
    dest = _layout('Di. RA 10', receiptsKokapetQty=10)
    dest['Diamond'].insert(
        1,
        {
            'kind': 'product',
            'label': 'Di. RA 20',
            'receiptsInternalQty': None,
            'receiptsJubileeHillsQty': None,
            'receiptsKokapetQty': 20,
        },
    )
    source = {
        'Diamond': [
            {'kind': 'product', 'label': 'Di. RA 10', 'issuesKokapetQty': 11},
            {'kind': 'product', 'label': 'Di. RA 20', 'issuesKokapetQty': 22},
        ]
    }
    dropped, review = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    by_label = {row['label']: row for row in dropped['Diamond'] if row.get('kind') == 'product'}
    assert by_label['Di. RA 10']['receiptsKokapetQty'] == 11
    assert by_label['Di. RA 20']['receiptsKokapetQty'] == 22
    products = {item['product'] for item in review}
    assert products == {'Di. RA 10', 'Di. RA 20'}


def test_missing_receiver_mr_keeps_source_issue_and_flags_unmatched():
    dest = _layout('Di. RA 10')
    source = _layout('Di. RA 10', issuesKokapetQty=100)
    dropped, review = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    assert _product(dropped)['receiptsKokapetQty'] == 100
    assert review[0]['status'] == 'unmatchedReceiver'
    assert review[0]['destinationMrQty'] is None


def test_duplicate_processing_does_not_double_receipt_qty():
    dest = _layout('Di. RA 10', receiptsKokapetQty=100)
    source = _layout('Di. RA 10', issuesKokapetQty=100)
    first, _ = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    second, _ = apply_source_issue_receipts(
        first,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    assert _product(first)['receiptsKokapetQty'] == 100
    assert _product(second)['receiptsKokapetQty'] == 100


def test_missing_source_rate_keeps_qty_and_flags_amount():
    dest = _layout('Di. RA 10', receiptsKokapetQty=40)
    source = _layout('Di. RA 10', issuesKokapetQty=100)
    dropped, _review = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    applied = apply_source_receipt_amounts(
        dropped,
        destination='kokapet',
        source_average_rates={'basheerbagh': []},
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsKokapetQty'] == 100
    assert row['receiptsKokapetAmt'] is None
    assert applied['receiptAmountReview'][0]['sourceBranch'] == 'basheerbagh'


def test_all_branch_directions_copy_source_issue_qty():
    cases = [
        ('basheerbagh', 'jubileeHills', 'issuesBanjaraHillsQty', 'receiptsJubileeHillsQty'),
        ('basheerbagh', 'kokapet', 'issuesKokapetQty', 'receiptsKokapetQty'),
        ('basheerbagh', 'basheerbagh', 'issuesInternalQty', 'receiptsInternalQty'),
        ('jubileeHills', 'basheerbagh', 'issuesBanjaraHillsQty', 'receiptsJubileeHillsQty'),
        ('jubileeHills', 'kokapet', 'issuesKokapetQty', 'receiptsJubileeHillsQty'),
        ('jubileeHills', 'jubileeHills', 'issuesInternalQty', 'receiptsInternalQty'),
        ('kokapet', 'jubileeHills', 'issuesBanjaraHillsQty', 'receiptsKokapetQty'),
        ('kokapet', 'kokapet', 'issuesInternalQty', 'receiptsInternalQty'),
    ]
    assert set(TRANSFER_DIRECTION_LOCATIONS) == {
        (source, dest) for source, dest, _i, _r in cases
    }
    for source, dest, issue_key, receipt_key in cases:
        dest_layout = _layout('Di. RA 10', **{receipt_key: 1})
        source_layout = _layout('Di. RA 10', **{issue_key: 8})
        dropped, review = apply_source_issue_receipts(
            dest_layout,
            destination=dest,
            source_issue_layouts={source: source_layout},
            source_opening_complete={source: True},
        )
        assert _product(dropped)[receipt_key] == 8, (source, dest)
        assert review[0]['sourceBranch'] == source
        assert review[0]['destinationBranch'] == dest


def test_party_lines_aggregate_before_matching():
    lines = aggregate_transfer_lines(
        [
            {'location': 'kokapet', 'party': 'Party A', 'product': 'Di. RA 10', 'quantity': 40},
            {'location': 'kokapet', 'party': 'Party A', 'product': 'Di. RA 10', 'quantity': 60},
        ]
    )
    assert len(lines) == 1
    assert lines[0]['quantity'] == 100


def test_receipt_amount_uses_source_average_rate_after_qty_drop():
    dest = _layout(
        'Di. RA 10',
        openingQty=4,
        openingAmt=40,
        receiptsKokapetQty=95,
        totalQty=99,
        totalAmt=40,
    )
    source = _layout('Di. RA 10', issuesKokapetQty=100)
    dropped, _review = apply_source_issue_receipts(
        dest,
        destination='kokapet',
        source_issue_layouts={'basheerbagh': source},
        source_opening_complete={'basheerbagh': True},
    )
    applied = apply_source_receipt_amounts(
        dropped,
        destination='kokapet',
        source_average_rates={'basheerbagh': [{'product': 'Di. RA 10', 'averageRateAmt': 2}]},
    )
    row = _product(applied['layoutByCategory'])
    assert row['receiptsKokapetQty'] == 100
    assert row['receiptsKokapetAmt'] == 200


def test_internal_issues_stay_on_the_same_branch_receipts():
    for branch in ('basheerbagh', 'kokapet', 'jubileeHills'):
        dest = _layout('Di. RA 10', receiptsInternalQty=1)
        source = _layout('Di. RA 10', issuesInternalQty=7)
        dropped, review = apply_source_issue_receipts(
            dest,
            destination=branch,
            source_issue_layouts={branch: source},
            source_opening_complete={branch: True},
        )
        assert _product(dropped)['receiptsInternalQty'] == 7, branch
        assert review[0]['sourceBranch'] == branch
        assert review[0]['destinationBranch'] == branch


def test_kokapet_internal_does_not_fill_basheerbagh_kokapet_receipts():
    dest = _layout('Di. RA 10', receiptsKokapetQty=3, receiptsInternalQty=4)
    source = _layout('Di. RA 10', issuesInternalQty=9)
    dropped, review = apply_source_issue_receipts(
        dest,
        destination='basheerbagh',
        source_issue_layouts={'kokapet': source},
        source_opening_complete={'kokapet': True},
    )
    row = _product(dropped)
    assert row['receiptsKokapetQty'] == 3
    assert row['receiptsInternalQty'] == 4
    assert review == []


def test_named_issue_location_maps_to_same_named_receipt_column():
    cases = [
        (
            'basheerbagh',
            'jubileeHills',
            'issuesBanjaraHillsQty',
            'receiptsJubileeHillsQty',
        ),
        ('basheerbagh', 'kokapet', 'issuesKokapetQty', 'receiptsKokapetQty'),
        (
            'kokapet',
            'jubileeHills',
            'issuesBanjaraHillsQty',
            'receiptsKokapetQty',
        ),
        ('jubileeHills', 'kokapet', 'issuesKokapetQty', 'receiptsJubileeHillsQty'),
        (
            'jubileeHills',
            'basheerbagh',
            'issuesBanjaraHillsQty',
            'receiptsJubileeHillsQty',
        ),
    ]
    for source, dest, issue_key, receipt_key in cases:
        dest_layout = _layout('Di. RA 10', **{receipt_key: 2})
        source_layout = _layout('Di. RA 10', **{issue_key: 12})
        dropped, _review = apply_source_issue_receipts(
            dest_layout,
            destination=dest,
            source_issue_layouts={source: source_layout},
            source_opening_complete={source: True},
        )
        assert _product(dropped)[receipt_key] == 12, (source, dest)


def test_two_sources_keep_separate_receipt_columns():
    dest = _layout('Di. RA 10', receiptsJubileeHillsQty=1, receiptsKokapetQty=1)
    bh = _layout('Di. RA 10', issuesBanjaraHillsQty=3)
    kp = _layout('Di. RA 10', issuesBanjaraHillsQty=4)
    first, _ = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': bh, 'kokapet': kp},
        source_opening_complete={'basheerbagh': True, 'kokapet': True},
    )
    second, _ = apply_source_issue_receipts(
        first,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': bh, 'kokapet': kp},
        source_opening_complete={'basheerbagh': True, 'kokapet': True},
    )
    row = _product(first)
    assert row['receiptsJubileeHillsQty'] == 3
    assert row['receiptsKokapetQty'] == 4
    row2 = _product(second)
    assert row2['receiptsJubileeHillsQty'] == 3
    assert row2['receiptsKokapetQty'] == 4


def test_one_loaded_source_does_not_clear_the_other_receipt_column():
    dest = _layout('Di. RA 10', receiptsJubileeHillsQty=3, receiptsKokapetQty=4)
    bh = _layout('Di. RA 10', issuesBanjaraHillsQty=3)
    dropped, _ = apply_source_issue_receipts(
        dest,
        destination='jubileeHills',
        source_issue_layouts={'basheerbagh': bh},
        source_opening_complete={'basheerbagh': True},
    )
    row = _product(dropped)
    assert row['receiptsJubileeHillsQty'] == 3
    assert row['receiptsKokapetQty'] == 4

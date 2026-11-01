"""Branch transfer mapping: MR/DC nets fill Receipts/Issues per destination branch."""

from app.engines.financials_engine.config.product_rule_book import (
    map_pivots_to_closing_stock_categories,
)
from app.engines.financials_engine.engine.jubilee_hills_placement import (
    _with_internal_as_jubilee_hills,
    place_jubilee_hills_products,
)
from app.engines.financials_engine.engine.mr_dc_closing_qty import map_mr_dc_qty_to_rule_book
from app.engines.financials_engine.engine.receipt_amounts import receipt_source_branch


SAMPLE_BOOK = {
    'Diamond': {
        'Diamonds': ['Di. RA 10', 'Di. Beads'],
    },
    'Emerald': {
        'Emeralds': ['Emeralds JEM 100'],
    },
    'Pearls': {},
    'Rubie': {},
    'Precious and Semi Precious': {},
}


def _product(layout_by_category, category, label):
    return next(
        row
        for row in layout_by_category[category]
        if row.get('kind') == 'product' and row.get('label') == label
    )


def test_basheerbagh_populates_all_three_issues_columns_from_mr_dc_net():
    """Basheerbagh keeps raw location nets: negative net → Issues for that location."""
    transfer = map_mr_dc_qty_to_rule_book(
        mr_pivots={
            'internalBasheerbagh': [{'product': 'Di. RA 10', 'sumOfQuantity': 1}],
            'jubileeHills': [{'product': 'Di. Beads', 'sumOfQuantity': 2}],
            'kokapet': [{'product': 'Emeralds JEM 100', 'sumOfQuantity': 1}],
        },
        dc_pivots={
            'internalBasheerbagh': [{'product': 'Di. RA 10', 'sumOfQuantity': 4}],
            'jubileeHills': [{'product': 'Di. Beads', 'sumOfQuantity': 5}],
            'kokapet': [{'product': 'Emeralds JEM 100', 'sumOfQuantity': 3}],
        },
        rule_book=SAMPLE_BOOK,
    )
    assert transfer['Di. RA 10']['issuesInternalQty'] == 3
    assert 'receiptsInternalQty' not in transfer['Di. RA 10']
    assert transfer['Di. Beads']['issuesBanjaraHillsQty'] == 3
    assert 'receiptsJubileeHillsQty' not in transfer['Di. Beads']
    assert transfer['Emeralds JEM 100']['issuesKokapetQty'] == 2
    assert 'receiptsKokapetQty' not in transfer['Emeralds JEM 100']


def test_jubilee_hills_receipts_come_from_internal_and_jubilee_location_nets():
    """Internal/Basheerbagh rows are folded into the Jubilee Hills (Basheerbagh) column."""
    remapped_mr = _with_internal_as_jubilee_hills(
        {
            'jubileeHills': [{'product': 'Di. RA 10', 'sumOfQuantity': 1}],
            'internalBasheerbagh': [{'product': 'Di. RA 10', 'sumOfQuantity': 6}],
            'kokapet': [{'product': 'Di. Beads', 'sumOfQuantity': 2}],
        }
    )
    remapped_dc = _with_internal_as_jubilee_hills(
        {
            'jubileeHills': [],
            'internalBasheerbagh': [{'product': 'Di. RA 10', 'sumOfQuantity': 2}],
            'kokapet': [],
        }
    )
    assert remapped_mr['internalBasheerbagh'] == []
    assert len(remapped_mr['jubileeHills']) == 2

    placed = place_jubilee_hills_products(
        sales_pivot=[],
        purchases_pivot=[],
        opening_pivot=[{'product': 'Di. RA 10', 'sumOfQuantity': 10, 'sumOfGross': 100}],
        mr_pivots={
            'jubileeHills': [{'product': 'Di. RA 10', 'sumOfQuantity': 1, 'sumOfGross': 9}],
            'internalBasheerbagh': [{'product': 'Di. RA 10', 'sumOfQuantity': 6, 'sumOfGross': 9}],
            'kokapet': [{'product': 'Di. Beads', 'sumOfQuantity': 2, 'sumOfGross': 9}],
        },
        dc_pivots={
            'internalBasheerbagh': [{'product': 'Di. RA 10', 'sumOfQuantity': 2, 'sumOfGross': 9}],
        },
    )
    ra = _product(placed['layoutByCategory'], 'Diamond', 'Di. RA 10')
    # Net = (1+6) - 2 = 5 Receipts into the Basheerbagh-labeled column.
    assert ra.get('receiptsJubileeHillsQty') == 5
    assert ra.get('receiptsInternalQty') in (None, 0)
    assert ra.get('issuesInternalQty') in (None, 0)
    beads = _product(placed['layoutByCategory'], 'Diamond', 'Di. Beads')
    assert beads.get('receiptsKokapetQty') == 2
    assert beads.get('issuesKokapetQty') in (None, 0)


def test_kokapet_receipts_use_same_location_nets_without_jubilee_fold():
    """Kokapet keeps Internal separate and does not fold it into Jubilee Hills."""
    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[],
        purchases_pivot=[],
        opening_pivot=[{'product': 'Di. RA 10', 'sumOfQuantity': 10, 'sumOfGross': 100}],
        mr_pivots={
            'internalBasheerbagh': [{'product': 'Di. RA 10', 'sumOfQuantity': 4}],
            'jubileeHills': [{'product': 'Di. RA 10', 'sumOfQuantity': 3}],
            'kokapet': [{'product': 'Di. Beads', 'sumOfQuantity': 2}],
        },
        dc_pivots={
            'kokapet': [{'product': 'Di. Beads', 'sumOfQuantity': 5}],
        },
        rule_book=SAMPLE_BOOK,
        destination_branch='kokapet',
    )
    ra = _product(mapped['layoutByCategory'], 'Diamond', 'Di. RA 10')
    assert ra.get('receiptsInternalQty') == 4
    assert ra.get('receiptsJubileeHillsQty') == 3
    assert ra.get('receiptsKokapetQty') in (None, 0)
    beads = _product(mapped['layoutByCategory'], 'Diamond', 'Di. Beads')
    assert beads.get('issuesKokapetQty') == 3
    assert beads.get('receiptsKokapetQty') in (None, 0)


def test_transfer_direction_does_not_duplicate_receipts_and_issues():
    transfer = map_mr_dc_qty_to_rule_book(
        mr_pivots={'jubileeHills': [{'product': 'Di. RA 10', 'sumOfQuantity': 7}]},
        dc_pivots={'jubileeHills': [{'product': 'Di. RA 10', 'sumOfQuantity': 2}]},
        rule_book=SAMPLE_BOOK,
    )
    entry = transfer['Di. RA 10']
    assert entry.get('receiptsJubileeHillsQty') == 5
    assert entry.get('issuesBanjaraHillsQty') in (None, 0)
    # Opposite sign must not also populate Issues for the same location.
    assert sum(1 for key in entry if key.startswith('issues')) == 0


def test_jubilee_receipt_column_uses_basheerbagh_average_rate_source():
    assert receipt_source_branch('jubileeHills', 'receiptsJubileeHillsQty') == 'basheerbagh'
    assert receipt_source_branch('basheerbagh', 'receiptsJubileeHillsQty') == 'jubileeHills'
    assert receipt_source_branch('kokapet', 'receiptsJubileeHillsQty') == 'jubileeHills'
    assert receipt_source_branch('kokapet', 'receiptsInternalQty') == 'basheerbagh'
    assert receipt_source_branch('kokapet', 'receiptsKokapetQty') == 'kokapet'


def test_saved_receipt_rate_mapping_applies_during_branch_process():
    """Scenario C/D: mapping saved before process fills receipt amount automatically."""
    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[],
        purchases_pivot=[],
        opening_pivot=[{'product': 'Di. RA 10', 'sumOfQuantity': 4, 'sumOfGross': 40}],
        mr_pivots={
            'jubileeHills': [{'product': 'Di. RA 10', 'sumOfQuantity': 2}],
        },
        dc_pivots={},
        rule_book=SAMPLE_BOOK,
        destination_branch='basheerbagh',
        source_average_rates={
            'jubileeHills': [{'product': 'Other Name RA 10', 'averageRateAmt': 12}],
        },
        receipt_rate_mappings=[
            {
                'product': 'Di. RA 10',
                'category': 'Diamond',
                'sourceBranch': 'jubileeHills',
                'sourceProduct': 'Other Name RA 10',
                'averageRateAmt': 12,
            }
        ],
    )
    ra = _product(mapped['layoutByCategory'], 'Diamond', 'Di. RA 10')
    assert ra.get('receiptsJubileeHillsQty') == 2
    assert ra.get('receiptsJubileeHillsAmt') == 24
    assert mapped['receiptAmountReview'] == []

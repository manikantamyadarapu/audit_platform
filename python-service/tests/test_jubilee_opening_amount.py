"""Jubilee Hills opening amount matching stays inside one category."""

from app.engines.financials_engine.engine.jubilee_opening_amount import (
    match_jubilee_opening_amounts,
)


def _index(*rows):
    index = {}
    for name, sheet, qty, amount in rows:
        index[name.casefold()] = {
            'product': name,
            'sheetName': sheet,
            'closingStockQty': qty,
            'closingStockAmount': amount,
        }
    return index


def _row(result, product):
    return next(row for row in result['validatedOpening'] if row['product'] == product)


def test_core_match_fills_amount_when_quantity_matches():
    result = match_jubilee_opening_amounts(
        quantity_rows=[
            {'product': 'FP 1', 'openingBalance': 4},
            {'product': 'JEM 100', 'openingBalance': 2},
            {'product': 'DB 25', 'openingBalance': 3},
        ],
        previous_year_index=_index(
            ('Flat Polki FP 1', 'Dia', 4, 400),
            ('Emeralds JEM 100', 'Eme', 2, 200),
            ('Diamond Beads DB 25', 'Dia', 3, 300),
            ('FP 10', 'Dia', 4, 999),
            ('JEM 1000', 'Eme', 2, 999),
        ),
    )
    fp = _row(result, 'FP 1')
    jem = _row(result, 'JEM 100')
    beads = _row(result, 'DB 25')
    assert fp['openingAmt'] == 400
    assert fp['matchMethod'] == 'core'
    assert fp['previousYearProduct'] == 'Flat Polki FP 1'
    assert jem['openingAmt'] == 200
    assert jem['category'] == 'Emerald'
    assert beads['openingAmt'] == 300
    assert result['match']['coreCodeMatches'] == 3
    assert result['match']['quantityVerifiedMatches'] == 3
    assert result['match']['manualMappingRequired'] == 0


def test_number_boundary_does_not_match_a_longer_code():
    result = match_jubilee_opening_amounts(
        quantity_rows=[{'product': 'FP 1', 'openingBalance': 4}],
        previous_year_index=_index(('FP 10', 'Dia', 4, 999), ('JEM 1000', 'Eme', 4, 50)),
    )
    row = _row(result, 'FP 1')
    assert row['openingAmt'] is None
    assert row['reason'] == 'no_candidate'
    names = [item['product'] for item in row['candidateProducts']]
    assert 'JEM 1000' not in names
    assert 'FP 10' in names


def test_quantity_mismatch_and_multiple_candidates_stay_manual():
    result = match_jubilee_opening_amounts(
        quantity_rows=[
            {'product': 'FP 1', 'openingBalance': 9},
            {'product': 'Chakri', 'openingBalance': 1},
        ],
        previous_year_index=_index(
            ('Flat Polki FP 1', 'Dia', 4, 400),
            ('Chakri a', 'Dia', 1, 10),
            ('Chakri b', 'Dia', 1, 20),
        ),
    )
    mismatch = _row(result, 'FP 1')
    multiple = _row(result, 'Chakri')
    assert mismatch['reason'] == 'quantity_mismatch'
    assert mismatch['openingAmt'] is None
    assert mismatch['suggestedProducts'][0]['closingStockQty'] == 4
    assert multiple['reason'] == 'multiple_candidates'
    assert {item['product'] for item in multiple['suggestedProducts']} == {'Chakri a', 'Chakri b'}
    assert result['match']['quantityMismatches'] == 1
    assert result['match']['multipleCandidateMatches'] == 1
    diamond_names = {item['product'] for item in mismatch['candidateProducts']}
    assert 'Flat Polki FP 1' in diamond_names
    assert 'Emeralds JEM 100' not in diamond_names


def test_saved_mapping_reuses_previous_amount_inside_the_same_category():
    result = match_jubilee_opening_amounts(
        quantity_rows=[{'product': 'FP 1', 'openingBalance': 9}],
        previous_year_index=_index(('Flat Polki FP 1', 'Dia', 4, 400)),
        saved_mappings=[{'product': 'FP 1', 'previousYearProduct': 'Flat Polki FP 1'}],
    )
    row = _row(result, 'FP 1')
    assert row['openingAmt'] == 400
    assert row['product'] == 'FP 1'
    assert row['category'] == 'Diamond'
    assert row['matchMethod'] == 'saved'
    assert result['match']['savedMappingsReused'] == 1
    assert result['match']['manualMappingRequired'] == 0


def test_manual_candidates_stay_on_the_previous_year_sheet():
    result = match_jubilee_opening_amounts(
        quantity_rows=[
            {'product': 'FP 1', 'openingBalance': 9},
            {'product': 'JEM 100', 'openingBalance': 9},
        ],
        previous_year_index=_index(
            ('Flat Polki FP 1', 'Dia', 4, 400),
            ('Polki JEM 9', 'Eme', 2, 90),
            ('Emeralds JEM 100', 'Eme', 2, 200),
        ),
    )
    diamond = _row(result, 'FP 1')
    emerald = _row(result, 'JEM 100')
    diamond_names = {item['product'] for item in diamond['candidateProducts']}
    emerald_names = {item['product'] for item in emerald['candidateProducts']}
    assert diamond_names == {'Flat Polki FP 1'}
    assert emerald_names == {'Polki JEM 9', 'Emeralds JEM 100'}
    assert {item['category'] for item in diamond['candidateProducts']} == {'Diamond'}
    assert {item['category'] for item in emerald['candidateProducts']} == {'Emerald'}


def test_product_without_a_category_is_flagged_and_not_dropped():
    result = match_jubilee_opening_amounts(
        quantity_rows=[{'product': 'Plain Finding', 'openingBalance': 2}],
        previous_year_index=_index(('Plain Finding', 'Dia', 2, 80)),
    )
    row = _row(result, 'Plain Finding')
    assert row['reason'] == 'category_not_resolved'
    assert row['openingAmt'] is None
    assert row['candidateProducts'] == []
    assert result['match']['unresolvedProductCount'] == 1


def test_loose_opening_rows_aggregate_before_matching():
    from app.engines.financials_engine.parsers.opening_stock_loader import _register_product_keys

    index: dict = {}
    _register_product_keys(
        index,
        {
            'product': 'DI RA 10',
            'sheetName': 'Dia',
            'closingStockQty': 3,
            'closingStockAmount': 30,
        },
    )
    _register_product_keys(
        index,
        {
            'product': 'DI RA LOOSE 10',
            'sheetName': 'Dia',
            'closingStockQty': 2,
            'closingStockAmount': 20,
        },
    )
    result = match_jubilee_opening_amounts(
        quantity_rows=[
            {'product': 'DI RA 10', 'openingBalance': 4},
            {'product': 'DI RA LOOSE 10', 'openingBalance': 1},
        ],
        previous_year_index=index,
    )
    row = _row(result, 'DI RA 10')
    assert row['openingQty'] == 5
    assert row['openingAmt'] == 50
    assert row['product'] == 'DI RA 10'
    names = {item['product'] for item in result['validatedOpening']}
    assert 'DI RA LOOSE 10' not in names

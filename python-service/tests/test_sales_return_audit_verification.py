"""Sales Return Audit — verification suite for edge cases (Tests 1–9)."""

from __future__ import annotations

from io import BytesIO

import pandas as pd
import polars as pl
import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.config.loader import grams_product_norms
from app.sales_engine.validators.uom_validator import UOM_CARATS, UOM_GRAMS, expected_uom_expr
from app.sales_engine.validators.unit_rate_range_validator import ZERO_TO_ONE_PRODUCTS
from app.sales_return_engine.engine.sales_return_audit_engine import (
    HIGHER_SALES_RETURN_RATE,
    HIGHER_SALES_RETURN_RATE_MSG,
    INVALID_FREE_QUANTITY,
    SalesReturnAuditEngine,
)
from app.utils.excel_exporter import (
    SALES_RETURN_RATE_COMPARISON_COLUMNS,
    SALES_RETURN_RATE_COMPARISON_HEADER_MAP,
    export_sales_return_rate_comparison,
)
from app.utils.normalization_engine import normalize_strict_text
from tests.test_sales_audit_processor import _row, _wb_bytes


def _build_excel_bytes(rows: list[dict]) -> bytes:
    dataframe = pd.DataFrame(rows)
    output = BytesIO()
    dataframe.to_excel(output, index=False)
    return output.getvalue()


def _stored_avg(product: str, gross: float, qty: float, account: str = '') -> list[dict]:
    return [
        {
            'product': product,
            'salesAccount': account,
            'totalGrossAmount': gross,
            'totalQuantity': qty,
            'averageRate': round(gross / qty, 4) if qty else 0,
        }
    ]


def _return_row(
    product: str,
    gross: float,
    qty: float,
    rate: float,
    account: str = 'GOLD SALES RETURN ACCOUNT - 22K',
    uom: str = 'Grams',
) -> dict:
    return {
        'Voucher No': 'V2',
        'Sales Return Account': account,
        'Product': product,
        'Unit Rate': rate,
        'Quantity': qty,
        'Gross Amount': gross,
        'UOM': uom,
    }


# ====================================================
# TEST 1 — Product missing in stored sales averages
# ====================================================
def test_product_missing_in_stored_averages_skipped() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes(
        [_return_row('Flat Polki FP 10', 50000, 5, 10000, 'GOLD SALES RETURN ACCOUNT - 22K')]
    )
    stored = _stored_avg('Di. RA 15', 150000, 10, 'JEWEL SALES ACCOUNT - DIAMONDS')
    result = engine.process(return_bytes, stored)
    assert result['rateComparisonRecords'] == []


# ====================================================
# TEST 2 — Zero quantity (no ZeroDivisionError)
# ====================================================
def test_zero_quantity_skipped_safely_no_division_error() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes(
        [
            _return_row('Gold Ornaments 22K', 10000, 0, 0),
            _return_row('Gold Ornaments 22K', 95000, 10, 9500),
        ]
    )
    stored = _stored_avg('Gold Ornaments 22K', 90000, 10)
    result = engine.process(return_bytes, stored)
    comparison = result['rateComparisonRecords']
    assert len(comparison) == 1
    assert comparison[0]['salesAverageRate'] == 9000
    assert comparison[0]['returnAverageRate'] == 9500


# ====================================================
# TEST 3 — UOM rules (grams vs carats)
# ====================================================
@pytest.mark.parametrize(
    'product,account,uom,unit_rate,should_pass',
    [
        ('Gold Ornaments 22K', 'Gold Sales Account - 22k', 'Grams', 14500, True),
        ('Gold Ornaments 22K', 'Gold Sales Account - 22k', 'Carats', 14500, False),
        ('Emeralds JEM 4400', 'Jewels sales account - Emeralds', 'Carats', 4400, True),
        ('Emeralds JEM 4400', 'Jewels sales account - Emeralds', 'Grams', 4400, False),
        ('Pearls JPS 2000', 'Jewels sales account - Pearls', 'Grams', 2000, True),
        ('Pearls JPS 2000', 'Jewels sales account - Pearls', 'Carats', 2000, False),
        ('Lac', 'Gold Sales Account - 22k', 'Grams', 0.5, True),
        ('Lac', 'Gold Sales Account - 22k', 'Carats', 0.5, False),
        ('Nail', 'Gold Sales Account - 22k', 'Grams', 0.5, True),
        ('Nail', 'Gold Sales Account - 22k', 'Carats', 0.5, False),
        ('Black beads', 'Gold Sales Account - 22k', 'Grams', 0.5, True),
    ],
)
def test_uom_rules_grams_vs_carats(product, account, uom, unit_rate, should_pass) -> None:
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='UOM1',
                    sales_account=account,
                    product=product,
                    unit_rate=unit_rate,
                    uom=uom,
                )
            ]
        )
    )
    if should_pass:
        assert out['errorRows'] == 0
    else:
        assert out['errorRows'] >= 1
        assert 'INVALID_UOM' in out['records'][0]['issues']


def test_pearls_literal_in_grams_product_norms() -> None:
    assert normalize_strict_text('Pearls') in grams_product_norms()


@pytest.mark.parametrize(
    'product,expected_uom',
    [
        ('DI. RA 15', UOM_CARATS),
        ('EMERALDS JEM 4400', UOM_CARATS),
        ('RUBIES JRU 5000', UOM_CARATS),
        ('COLOR STONES CS 1200', UOM_CARATS),
        ('GOLD ORNAMENTS 22K', UOM_GRAMS),
        ('SILVER ARTICLES', UOM_GRAMS),
        ('PEARLS JPS 2000', UOM_GRAMS),
        ('LAC', UOM_GRAMS),
        ('NAIL', UOM_GRAMS),
        ('DORI', UOM_GRAMS),
        ('BLACK BEADS', UOM_GRAMS),
        ('WAX, DORI ETC', UOM_GRAMS),
    ],
)
def test_expected_uom_by_product_category(product: str, expected_uom: str) -> None:
    frame = pl.DataFrame({'__product_norm': [product]})
    result = frame.with_columns(expected_uom_expr()).to_dicts()[0]
    assert result['__expected_uom'] == expected_uom


def test_diamond_uom_invalid_when_grams_on_return_validation() -> None:
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='UOM-D',
                    sales_account='Jewel sales account - Diamonds',
                    product='Di. RA 15',
                    unit_rate=15000,
                    uom='Grams',
                )
            ]
        )
    )
    assert out['errorRows'] >= 1
    assert 'INVALID_UOM' in out['records'][0]['issues']


def test_zero_to_one_product_list_matches_spec() -> None:
    expected = {
        'LAC',
        'NAIL',
        'DORI',
        'BLACK BEADS',
        'WAX',
        'WAX, DORI ETC',
        'WAX DORI ETC',
    }
    assert expected <= ZERO_TO_ONE_PRODUCTS


# ====================================================
# TEST 4 — Free quantity products (unit rate 0–1)
# ====================================================
@pytest.mark.parametrize('unit_rate,valid', [(0, True), (0.01, True), (0.5, True), (1.0, True), (1.01, False), (2, False), (10, False)])
def test_free_quantity_unit_rate_range_on_return_file(unit_rate, valid) -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes([_return_row('Lac', 100, 1, unit_rate)])
    result = engine.process(return_bytes, _stored_avg('Lac', 100, 1))
    return_records = result['validationIssues']
    invalid = [r for r in return_records if INVALID_FREE_QUANTITY in (r.get('issues') or [])]
    if valid:
        assert not invalid
    else:
        assert len(invalid) >= 1
        assert invalid[0]['issues'] == [INVALID_FREE_QUANTITY]


# ====================================================
# TEST 5 — Average rate = SUM(gross) / SUM(qty)
# ====================================================
def test_average_rate_uses_sum_gross_over_sum_qty_not_row_average() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes(
        [
            _return_row('Gold Ornaments 22K', 10000, 10, 1000),
            _return_row('Gold Ornaments 22K', 5000, 5, 2000),
        ]
    )
    return_loaded = engine._load_sheet(return_bytes, label='Sales return audit file', is_return=True)
    averages = engine._product_averages_from_loaded(return_loaded)
    avg = averages['Gold Ornaments 22K']
    assert avg.total_gross_amount == 15000
    assert avg.total_quantity == 15
    assert avg.average_rate == 1000
    row_avg = (1000 + 2000) / 2
    assert avg.average_rate != row_avg


# ====================================================
# TEST 6 — Exact product matching only
# ====================================================
def test_no_partial_product_match_between_similar_names() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes(
        [
            _return_row('Di. RA 150', 170000, 10, 17000, 'JEWEL SALES RETURN ACCOUNT - DIAMONDS', 'Carats'),
            _return_row('Flat Polki FP 10', 50000, 5, 10000),
        ]
    )
    stored = _stored_avg('Di. RA 15', 150000, 10, 'JEWEL SALES ACCOUNT - DIAMONDS')
    result = engine.process(return_bytes, stored)
    comparison = {row['product']: row for row in result['rateComparisonRecords']}
    assert 'Di. RA 150' not in comparison
    assert 'Flat Polki FP 10' not in comparison
    assert 'Di. RA 15' not in comparison


# ====================================================
# TEST 7 — One output row per violating product
# ====================================================
def test_one_comparison_row_per_product_with_multiple_return_lines() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes(
        [
            _return_row('Gold Ornaments 22K', 47500, 5, 9500),
            _return_row('Gold Ornaments 22K', 47500, 5, 9500),
        ]
    )
    stored = _stored_avg('Gold Ornaments 22K', 900000, 100)
    result = engine.process(return_bytes, stored)
    comparison = result['rateComparisonRecords']
    assert len(comparison) == 1
    assert comparison[0]['returnTotalGrossAmount'] == 95000
    assert comparison[0]['returnTotalQuantity'] == 10

    product_report = result['productAverageComparisonRecords']
    assert len(product_report) == 1
    assert product_report[0]['returnTransactionCount'] == 2
    assert product_report[0]['status'] == 'VIOLATION'


def test_product_average_comparison_includes_all_return_products() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes(
        [
            _return_row('Gold Ornaments 22K', 95000, 10, 9500),
            _return_row('Gold Ornaments 18K', 80000, 10, 8000),
        ]
    )
    stored = [
        _stored_avg('Gold Ornaments 22K', 900000, 100),
        _stored_avg('Gold Ornaments 18K', 900000, 100),
    ]
    result = engine.process(return_bytes, stored)
    report = {row['product']: row for row in result['productAverageComparisonRecords']}
    assert len(report) == 2
    assert report['Gold Ornaments 22K']['status'] == 'VIOLATION'
    assert report['Gold Ornaments 18K']['status'] == 'OK'
    assert report['Gold Ornaments 18K']['issues'] == []


# ====================================================
# TEST 8 — Export file columns
# ====================================================
def test_export_excel_has_required_columns() -> None:
    record = {
        'product': 'Gold Ornaments 22K',
        'returnTransactionCount': 3,
        'salesTotalGrossAmount': 900000,
        'salesTotalQuantity': 100,
        'salesAverageRate': 9000,
        'returnTotalGrossAmount': 95000,
        'returnTotalQuantity': 10,
        'returnAverageRate': 9500,
        'difference': 500,
        'Message': HIGHER_SALES_RETURN_RATE_MSG,
    }
    excel_bytes = export_sales_return_rate_comparison([record])
    df = pd.read_excel(BytesIO(excel_bytes), sheet_name='Product Average Comparison')
    headers = list(df.columns)
    expected_headers = [SALES_RETURN_RATE_COMPARISON_HEADER_MAP[col] for col in SALES_RETURN_RATE_COMPARISON_COLUMNS]
    assert headers == expected_headers
    assert df.iloc[0]['Product'] == 'Gold Ornaments 22K'
    assert df.iloc[0]['Message'] == HIGHER_SALES_RETURN_RATE_MSG


# ====================================================
# TEST 9 — Higher sales return rate
# ====================================================
def test_higher_sales_return_rate_example() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes([_return_row('Gold Ornaments 22K', 95000, 10, 9500)])
    stored = _stored_avg('Gold Ornaments 22K', 900000, 100)
    result = engine.process(return_bytes, stored)
    comparison = result['rateComparisonRecords']
    assert len(comparison) == 1
    row = comparison[0]
    assert row['issues'] == [HIGHER_SALES_RETURN_RATE]
    assert row['messages'] == [HIGHER_SALES_RETURN_RATE_MSG]
    assert row['salesAverageRate'] == 9000
    assert row['returnAverageRate'] == 9500
    assert row['difference'] == 500

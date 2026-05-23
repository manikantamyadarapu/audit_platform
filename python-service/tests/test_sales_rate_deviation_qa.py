"""QA matrix for gold/silver rule-book rate deviation and row-level dedupe."""

import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.engine.record_dedup import dedupe_invalid_records_by_row_number
from app.sales_engine.services.metal_rate_store import save_rule_book
from app.sales_engine.validators.sales_audit_messages import (
    MSG_PRODUCT_MAPPING,
    MSG_RATE_ABOVE,
    MSG_RATE_BELOW,
    MSG_UNIT_RATE_MISSING,
)
from tests.test_sales_audit_processor import _row, _wb_bytes


@pytest.fixture(autouse=True)
def _rule_book_22k():
    save_rule_book({'rates': {'Gold Ornaments 22K': 9000, 'Gold Ornaments 18K': 7500}})


def test_valid_rate_within_band_not_in_invalid_export():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='V-OK',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=9500,
                )
            ]
        )
    )
    assert out['errorRows'] == 0
    assert out['records'] == []


def test_rate_below_minimum_message():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='V-LOW',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=5800,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_RATE_DEVIATION']
    assert MSG_RATE_BELOW in rec['messages']
    assert rec['minAllowedRate'] == 6300
    assert rec['maxAllowedRate'] == 11700
    assert rec['currentMarketRate'] == 9000


def test_rate_above_maximum_message():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='V-HI',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=12500,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert MSG_RATE_ABOVE in rec['messages']


def test_product_mapping_mismatch_message():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='V-MAP',
                    sales_account='Gold Sales Account - 14K',
                    product='Gold Ornaments Jadau',
                    unit_rate=9000,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_PRODUCT_MAPPING']
    assert MSG_PRODUCT_MAPPING in rec['messages']


def test_market_rate_not_configured_skips_rate_invalid():
    save_rule_book({'rates': {'Gold Ornaments 22K': None}})
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='V-NORATE',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=5800,
                )
            ]
        )
    )
    assert out['errorRows'] == 0


def test_null_unit_rate_message():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='V-EMPTY',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate='',
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['MISSING_UNIT_RATE']
    assert MSG_UNIT_RATE_MISSING in rec['messages']


def test_same_voucher_two_products_two_invalid_rows():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='INV-1',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=5800,
                ),
                _row(
                    voucher='INV-1',
                    sales_account='Gold Sales Account - 18k',
                    product='Gold Ornaments 18K',
                    unit_rate=1000,
                ),
            ]
        )
    )
    assert out['errorRows'] == 2
    rows = {r['rowNumber'] for r in out['records']}
    assert len(rows) == 2
    vouchers = [r['voucherNo'] for r in out['records']]
    assert all('INV' in v for v in vouchers)


def test_duplicate_invalid_rows_merged_to_one_per_excel_row():
    records = [
        {
            'rowNumber': 5,
            'voucherNo': 'X',
            'product': 'Gold Ornaments 22K',
            'unitRate': 5800,
            'issues': ['INVALID_RATE_DEVIATION'],
            'messages': [MSG_RATE_BELOW],
        },
        {
            'rowNumber': 5,
            'voucherNo': 'X',
            'product': 'Gold Ornaments 22K',
            'unitRate': 5800,
            'issues': ['INVALID_PRODUCT_MAPPING'],
            'messages': [MSG_PRODUCT_MAPPING],
        },
    ]
    merged, count = dedupe_invalid_records_by_row_number(records)
    assert count == 1
    assert set(merged[0]['issues']) == {'INVALID_RATE_DEVIATION', 'INVALID_PRODUCT_MAPPING'}
    assert merged[0]['messages'] == [MSG_PRODUCT_MAPPING]


def test_messages_no_legacy_plus_minus_encoding():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='V-ENC',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=5800,
                )
            ]
        )
    )
    text = ' '.join(out['records'][0]['messages'])
    assert '±' not in text
    assert 'Â' not in text
    assert '30%' not in text

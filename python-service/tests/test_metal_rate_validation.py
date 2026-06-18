import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.services.metal_rate_store import save_rule_book
from tests.test_sales_audit_processor import _row, _wb_bytes


@pytest.fixture(autouse=True)
def _seed_rule_book():
    save_rule_book(
        {
            'rates': {
                'Gold Ornaments 14K': 6000,
                'Gold Ornaments 18K': 7500,
                'Customer Gold Ornaments 18K': 7600,
                'Customer Gold Ornaments 22K': 8800,
                'Gold Ornaments 22K': 9000,
                'Gold Ornaments Jadau': 9500,
                'Standard Gold 24K': 9800,
                'Silver articles': 120,
            }
        }
    )


def test_gold_22k_ornaments_invalid_when_unit_rate_below_band():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='G22',
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
    assert rec['currentMarketRate'] == 9000
    assert rec['minAllowedRate'] == 7650
    assert rec['maxAllowedRate'] == 10350
    assert rec['rateValidationSource'] == 'rule_book_product'


def test_gold_22k_ornaments_valid_at_entered_rate():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='G22OK',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=9000,
                )
            ]
        )
    )
    assert out['errorRows'] == 0


def test_customer_gold_22k_uses_own_rule_book_rate():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='C22',
                    sales_account='Gold Sales Account - 22k',
                    product='Customer Gold Ornaments 22K',
                    unit_rate=5000,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    assert out['records'][0]['currentMarketRate'] == 8800


def test_gold_black_beads_skips_rate_check_not_in_rule_book():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='BB',
                    sales_account='Gold Sales Account - 22k',
                    product='Black beads',
                    unit_rate=999999,
                )
            ]
        )
    )
    assert out['errorRows'] == 0


def test_silver_articles_invalid_outside_band():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='SV',
                    sales_account='Silver sales Account',
                    product='Silver articles',
                    unit_rate=200,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']


def test_gold_jadau_ornaments_invalid_when_unit_rate_below_band():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='JAD',
                    sales_account='Gold Sales Account - Jadau',
                    product='Gold Ornaments Jadau',
                    unit_rate=5000,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_RATE_DEVIATION']
    assert rec['currentMarketRate'] == 9500


def test_rate_rules_api_roundtrip():
    saved = save_rule_book(
        {
            'rates': {
                'Gold Ornaments 22K': {'min_rate': 9100, 'max_rate': 9200},
                'Silver articles': {'min_rate': 130, 'max_rate': 130},
            }
        }
    )
    assert saved['rates']['Gold Ornaments 22K']['min_rate'] == 9100
    assert saved['rates']['Gold Ornaments 22K']['max_rate'] == 9200
    assert saved['rates']['Silver articles']['min_rate'] == 130


def test_metal_min_max_band_user_example():
    save_rule_book({'rates': {'Gold Ornaments 22K': {'min_rate': 14000, 'max_rate': 15000}}})
    proc = SalesAuditProcessor()
    out_ok = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='MM-OK',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=16000,
                )
            ]
        )
    )
    assert out_ok['errorRows'] == 0
    out_bad = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='MM-BAD',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=9000,
                )
            ]
        )
    )
    assert out_bad['errorRows'] == 1
    rec = out_bad['records'][0]
    assert rec['minAllowedRate'] == 11900
    assert rec['maxAllowedRate'] == 17250

import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.services.metal_rate_store import save_market_rates
from tests.test_sales_audit_processor import _row, _wb_bytes


@pytest.fixture(autouse=True)
def _seed_market_rates():
    save_market_rates(
        {
            'gold_14k_rate': 6000,
            'gold_18k_rate': 7500,
            'gold_22k_rate': 9000,
            'gold_jadau_rate': 9500,
            'gold_24k_rate': 9800,
            'silver_rate': 120,
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
    assert rec['minAllowedRate'] == 6300
    assert rec['maxAllowedRate'] == 11700
    assert rec['rateValidationSource'] == 'account_market_rate'


def test_gold_22k_ornaments_valid_at_market_rate():
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


def test_gold_black_beads_skips_metal_rate_check():
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
    assert rec['minAllowedRate'] == 6650
    assert rec['maxAllowedRate'] == 12350


def test_rate_rules_api_roundtrip():
    from app.sales_engine.services.metal_rate_store import api_response_from_stored, load_market_rates

    saved = save_market_rates({'gold_22k_rate': 9100, 'silver_rate': 130})
    loaded = load_market_rates()
    api = api_response_from_stored(loaded)
    assert api['gold_22k_rate'] == 9100
    assert api['silver_rate'] == 130

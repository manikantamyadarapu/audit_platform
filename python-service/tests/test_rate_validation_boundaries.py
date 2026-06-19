"""Inclusive rate-band boundary checks across gold, silver, diamonds, and gemstones."""

import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.config.loader import (
    clear_metal_rate_caches,
    diamond_final_bands_by_product,
    metal_final_bands_by_product,
)
from app.sales_engine.services.metal_rate_store import save_rule_book
from tests.test_sales_audit_processor import _row, _wb_bytes

_GOLD_18K_ACCOUNT = 'Gold Sales Account - 18k'
_DIAMOND_ACCOUNT = 'Jewel sales account - Diamonds'


@pytest.fixture
def gold_18k_rule_book():
    save_rule_book(
        {
            'rates': {
                'Gold Ornaments 18K': {'min_rate': 11800, 'max_rate': 12000},
            }
        }
    )
    clear_metal_rate_caches()


def _assert_boundary_audit(
    *,
    sales_account: str,
    product: str,
    unit_rate: float,
    expect_error: bool,
    expected_min: float | None = None,
    expected_max: float | None = None,
    uom: str | None = None,
):
    row_kwargs = {
        'voucher': f'B-{unit_rate}',
        'sales_account': sales_account,
        'product': product,
        'unit_rate': unit_rate,
    }
    if uom is not None:
        row_kwargs['uom'] = uom
    proc = SalesAuditProcessor()
    out = proc.process(_wb_bytes([_row(**row_kwargs)]))
    if expect_error:
        assert out['errorRows'] == 1, f'unit_rate={unit_rate} should fail'
        rec = out['records'][0]
        assert rec['issues'] == ['INVALID_RATE_DEVIATION']
        assert rec['product'] == product.upper()
        if expected_min is not None:
            assert rec['minAllowedRate'] == expected_min
        if expected_max is not None:
            assert rec['maxAllowedRate'] == expected_max
        assert rec['unitRate'] == unit_rate
        assert rec['validationStatus'] == 'INVALID'
    else:
        assert out['errorRows'] == 0, f'unit_rate={unit_rate} should pass'
        assert out['records'] == []


def test_gold_18k_band_edges_are_rounded():
    save_rule_book(
        {'rates': {'Gold Ornaments 18K': {'min_rate': 11800, 'max_rate': 12000}}}
    )
    clear_metal_rate_caches()
    band = metal_final_bands_by_product()['GOLD ORNAMENTS 18K']
    assert band['final_min'] == 10030.0
    assert band['final_max'] == 13800.0


@pytest.mark.parametrize('unit_rate', [10029, 13801])
def test_gold_ornaments_18k_failing_row_debug_fields(gold_18k_rule_book, unit_rate):
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher=f'DBG-{unit_rate}',
                    sales_account=_GOLD_18K_ACCOUNT,
                    product='Gold Ornaments 18K',
                    unit_rate=unit_rate,
                )
            ]
        )
    )
    rec = out['records'][0]
    assert rec['product'] == 'GOLD ORNAMENTS 18K'
    assert rec['currentMarketRate'] == 11900.0
    assert rec['minAllowedRate'] == 10030.0
    assert rec['maxAllowedRate'] == 13800.0
    assert rec['unitRate'] == unit_rate
    assert rec['validationStatus'] == 'INVALID'
    assert rec['issues'] == ['INVALID_RATE_DEVIATION']


@pytest.mark.parametrize(
    'unit_rate,expect_error',
    [
        (10030, False),
        (13800, False),
        (10029, True),
        (13801, True),
    ],
)
def test_gold_ornaments_18k_inclusive_boundaries(
    gold_18k_rule_book, unit_rate, expect_error
):
    _assert_boundary_audit(
        sales_account=_GOLD_18K_ACCOUNT,
        product='Gold Ornaments 18K',
        unit_rate=unit_rate,
        expect_error=expect_error,
        expected_min=10030.0,
        expected_max=13800.0,
    )


def test_gold_22k_upper_boundary_inclusive():
    save_rule_book({'rates': {'Gold Ornaments 22K': {'min_rate': 14500, 'max_rate': 15000}}})
    clear_metal_rate_caches()
    band = metal_final_bands_by_product()['GOLD ORNAMENTS 22K']
    assert band['final_min'] == 12325.0
    assert band['final_max'] == 17250.0
    _assert_boundary_audit(
        sales_account='Gold Sales Account - 22k',
        product='Gold Ornaments 22K',
        unit_rate=17250,
        expect_error=False,
    )
    _assert_boundary_audit(
        sales_account='Gold Sales Account - 22k',
        product='Gold Ornaments 22K',
        unit_rate=17251,
        expect_error=True,
        expected_min=12325.0,
        expected_max=17250.0,
    )


def test_silver_articles_inclusive_boundaries():
    save_rule_book({'rates': {'Silver articles': {'min_rate': 170, 'max_rate': 200}}})
    clear_metal_rate_caches()
    _assert_boundary_audit(
        sales_account='Silver sales Account',
        product='Silver articles',
        unit_rate=144.5,
        expect_error=False,
    )
    _assert_boundary_audit(
        sales_account='Silver sales Account',
        product='Silver articles',
        unit_rate=230.0,
        expect_error=False,
    )
    _assert_boundary_audit(
        sales_account='Silver sales Account',
        product='Silver articles',
        unit_rate=144.49,
        expect_error=True,
        expected_min=144.5,
        expected_max=230.0,
    )


def test_diamond_di_ra_10_inclusive_boundaries():
    band = diamond_final_bands_by_product()['DI. RA 10']
    final_min = band['final_min']
    final_max = band['final_max']
    proc = SalesAuditProcessor()
    for rate in (final_min, final_max):
        out = proc.process(
            _wb_bytes(
                [
                    _row(
                        voucher=f'D-{rate}',
                        sales_account=_DIAMOND_ACCOUNT,
                        product='DI. RA 10',
                        unit_rate=rate,
                    )
                ]
            )
        )
        assert out['errorRows'] == 0, f'diamond rate {rate} should pass'
    out_fail = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='D-FAIL',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 10',
                    unit_rate=final_max + 1,
                )
            ]
        )
    )
    rec = out_fail['records'][0]
    assert rec['issues'] == ['INVALID_RATE_DEVIATION']
    assert rec['minAllowedRate'] == pytest.approx(final_min)
    assert rec['maxAllowedRate'] == pytest.approx(final_max)
    assert rec['unitRate'] == final_max + 1


@pytest.mark.parametrize(
    'sales_account,product,fail_low,fail_high,uom',
    [
        ('Jewels sales account - Rubies', 'Rubies JRU 1000', 849, 1151, None),
        ('Jewels sales account - Pearls', 'Pearls JPS 2000', 1699, 2301, 'Grams'),
        ('Jewels sales account - Emeralds', 'Emeralds JEM 10500', 8924, 12076, None),
    ],
)
def test_gemstone_inclusive_boundaries(
    sales_account, product, fail_low, fail_high, uom
):
    slab = int(product.rsplit(' ', 1)[-1])
    expected_min = round(slab * 0.85, 2)
    expected_max = round(slab * 1.15, 2)
    uom_kw = {'uom': uom} if uom else {}
    _assert_boundary_audit(
        sales_account=sales_account,
        product=product,
        unit_rate=expected_min,
        expect_error=False,
        **uom_kw,
    )
    _assert_boundary_audit(
        sales_account=sales_account,
        product=product,
        unit_rate=expected_max,
        expect_error=False,
        **uom_kw,
    )
    _assert_boundary_audit(
        sales_account=sales_account,
        product=product,
        unit_rate=fail_low,
        expect_error=True,
        expected_min=expected_min,
        expected_max=expected_max,
        **uom_kw,
    )
    _assert_boundary_audit(
        sales_account=sales_account,
        product=product,
        unit_rate=fail_high,
        expect_error=True,
        expected_min=expected_min,
        expected_max=expected_max,
        **uom_kw,
    )

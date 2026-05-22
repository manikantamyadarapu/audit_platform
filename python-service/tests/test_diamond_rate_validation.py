import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.config.loader import diamond_final_bands_by_product
from tests.test_sales_audit_processor import _row, _wb_bytes

_DIAMOND_ACCOUNT = 'Jewel sales account - Diamonds'


def test_diamond_band_precompute_di_ra_10():
    band = diamond_final_bands_by_product()['DI. RA 10']
    assert band['base_min'] == 10000
    assert band['base_max'] == 15000
    assert band['final_min'] == pytest.approx(8750.0)
    assert band['final_max'] == pytest.approx(24375.0)


def test_valid_diamond_rate_inside_band():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='DV1',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 10',
                    unit_rate=15000,
                )
            ]
        )
    )
    assert out['errorRows'] == 0
    assert out['summary']['rateDeviationViolations'] == 0


def test_diamond_rate_below_minimum():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='DB1',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 10',
                    unit_rate=8000,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_RATE_DEVIATION']
    assert rec['rateValidationSource'] == 'diamond_rule_book'
    assert rec['minAllowedRate'] == pytest.approx(8750.0)
    assert rec['maxAllowedRate'] == pytest.approx(24375.0)
    assert 'below allowed diamond range' in rec['rateMessage'].lower()


def test_diamond_rate_above_maximum():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='DA1',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 10',
                    unit_rate=25000,
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    assert 'above allowed diamond range' in out['records'][0]['rateMessage'].lower()


def test_diamond_without_rule_book_skips_rate_check():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='DC1',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='Chakri',
                    unit_rate=999999,
                )
            ]
        )
    )
    assert out['errorRows'] == 0


def test_diamond_missing_unit_rate():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='DM1',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 20',
                    unit_rate='',
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']
    assert 'missing' in out['records'][0]['rateMessage'].lower()


def test_same_voucher_multiple_diamond_rows_stay_separate():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='MV',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 10',
                    unit_rate=8000,
                ),
                _row(
                    voucher='MV',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 20',
                    unit_rate=5000,
                ),
            ]
        )
    )
    assert out['errorRows'] == 2
    assert len(out['records']) == 2
    products = {r['product'] for r in out['records']}
    assert products == {'DI. RA 10', 'DI. RA 20'}
    row_numbers = [r['rowNumber'] for r in out['records']]
    assert len(row_numbers) == len(set(row_numbers))


def test_same_voucher_mixed_valid_and_invalid_diamond_products():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='MX',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='DI. RA 10',
                    unit_rate=15000,
                ),
                _row(
                    voucher='MX',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='SD DI. 200',
                    unit_rate=100000,
                ),
            ]
        )
    )
    assert out['errorRows'] == 1
    assert len(out['records']) == 1
    assert out['records'][0]['product'] == 'SD DI. 200'


def test_compact_dot_product_name_validates():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='DD',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='Di.RA 15',
                    unit_rate=17500,
                )
            ]
        )
    )
    assert out['errorRows'] == 0


def test_sd_di_275_valid_at_mid_band():
    band = diamond_final_bands_by_product()['SD DI. 275']
    mid = (band['final_min'] + band['final_max']) / 2.0
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='SD',
                    sales_account=_DIAMOND_ACCOUNT,
                    product='SD DI. 275',
                    unit_rate=mid,
                )
            ]
        )
    )
    assert out['errorRows'] == 0

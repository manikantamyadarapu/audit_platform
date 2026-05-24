import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.validators.uom_validator import normalize_uom_value
from tests.test_sales_audit_processor import _row, _wb_bytes


@pytest.mark.parametrize(
    'raw,expected',
    [
        ('Grams', 'GRAMS'),
        ('grams', 'GRAMS'),
        ('GMS', 'GRAMS'),
        ('Gm', 'GRAMS'),
        ('Carats', 'CARATS'),
        ('carat', 'CARATS'),
        ('crt', 'CARATS'),
        ('cts', 'CARATS'),
        ('', None),
        ('Pieces', None),
    ],
)
def test_normalize_uom_value(raw, expected):
    assert normalize_uom_value(raw) == expected


def test_gold_22k_grams_uom_valid():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='U1',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=14500,
                    uom='Grams',
                )
            ]
        )
    )
    assert out['errorRows'] == 0


def test_gold_22k_carats_uom_invalid():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='U2',
                    sales_account='Gold Sales Account - 22k',
                    product='Gold Ornaments 22K',
                    unit_rate=14500,
                    uom='Carats',
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_UOM']
    assert rec['messages'] == ['Invalid UOM for product.']


def test_di_ra_20_carats_uom_valid():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='U3',
                    sales_account='Jewel sales account - Diamonds',
                    product='Di. RA 20',
                    unit_rate=20000,
                    uom='Carats',
                )
            ]
        )
    )
    assert out['errorRows'] == 0


def test_di_ra_20_grams_uom_invalid():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='U4',
                    sales_account='Jewel sales account - Diamonds',
                    product='Di. RA 20',
                    unit_rate=20000,
                    uom='Grams',
                )
            ]
        )
    )
    assert out['errorRows'] == 1
    rec = out['records'][0]
    assert rec['issues'] == ['INVALID_UOM']
    assert 'Invalid UOM for product.' in rec['messages']

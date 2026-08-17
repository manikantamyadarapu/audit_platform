import re

import pytest

from app.engines.sales_engine.engine.processor import SalesAuditProcessor
from tests.test_sales_audit_processor import _row, _wb_bytes


def _catalog_unit_rate(product: str) -> float:
    """Use slab from product suffix when rate validation applies; else any positive rate."""
    from app.engines.sales_engine.config.loader import diamond_final_bands_by_product
    from app.utils.normalization_engine import normalize_strict_text

    norm = normalize_strict_text(product)
    band = diamond_final_bands_by_product().get(norm)
    if band is not None:
        return (band['final_min'] + band['final_max']) / 2.0

    match = re.search(r'(\d+)\s*$', product.strip())
    if match and re.search(r'\b(JEM|JRU|JPS|JOS|JSP|JSY)\s+\d+', product, re.I):
        return float(match.group(1))
    if match and re.search(r'\bDI\.\s*RA\s+\d+', product, re.I):
        return float(match.group(1))
    return float(match.group(1)) if match else 100.0

@pytest.mark.parametrize(
    'sales_account,product',
    [
        ('Gold Sales Account - 14K', 'Gold Ornaments 14K'),
        ('Gold Sales Account - 22k', 'Wax, Dori Etc'),
        ('Gold Sales Account - 22k', 'Black beads'),
        ('Gold Sales Account - Jadau', 'Gold Ornaments Jadau'),
        ('Gold Sales Account -24K', 'Standard Gold 24K'),
        ('Silver sales Account', 'Silver articles'),
        ('Jewel sales account - Diamonds', 'Chakri'),
        ('Jewel sales account - Diamonds', 'Flat polki FP 12'),
        ('Jewel sales account - Diamonds', 'Diamonds Loose Di. RA 30'),
        ('Jewel sales account - Diamonds', 'Di. RC 30'),
        ('Jewel sales account - Diamonds', 'Di. RA 15'),
        ('Jewel sales account - Diamonds', 'Flat polki FP 10'),
        ('Jewel sales account - Diamonds', 'SD Di. Mix'),
        ('Jewel sales account - Diamonds', 'Customer Flat Polki'),
        ('Jewel sales account - Diamonds', 'Polki a'),
        ('Gold Sales Account - 18k', 'Customer Gold Ornaments 18K'),
        ('Jewels sales account - Color stones', 'Precious stones JOS 3600'),
        ('Jewels sales account - Color stones', 'Precious stones Loose JOS 2000'),
        ('Jewels sales account - Color stones', 'Semi precious JSP 500'),
        ('Jewels sales account - Color stones', 'Synthetic JSY 150'),
        ('Jewels sales account - Emeralds', 'Emeralds JEM 4400'),
        ('Jewels sales account - Pearls', 'Pearls JPS 2000'),
        ('Jewels sales account - Rubies', 'Rubies JRU Mix'),
    ],
)
def test_sales_ledger_catalog_valid_mappings(sales_account: str, product: str):
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='CAT',
                    sales_account=sales_account,
                    product=product,
                    unit_rate=_catalog_unit_rate(product),
                )
            ]
        )
    )
    assert out['errorRows'] == 0, (sales_account, product, out['records'])


@pytest.mark.parametrize(
    'sales_account,product',
    [
        ('Gold Sales Account - 14K', 'Gold Ornaments Jadau'),
        ('Jewels sales account - Pearls', 'Rubies JRU 1000'),
        ('Jewels sales account - Rubies', 'Pearls JPS 2000'),
    ],
)
def test_sales_ledger_catalog_invalid_cross_account(sales_account: str, product: str):
    proc = SalesAuditProcessor()
    out = proc.process(_wb_bytes([_row(voucher='X', sales_account=sales_account, product=product, unit_rate=100)]))
    assert out['errorRows'] == 1
    assert out['records'][0]['issues'] == ['INVALID_PRODUCT_MAPPING']

"""Every authoritative gemstone SKU from gemstone_product_catalog.json must audit cleanly."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.engines.sales_engine.engine.processor import SalesAuditProcessor
from tests.test_sales_audit_processor import _row, _wb_bytes

_CATALOG_PATH = (
    Path(__file__).resolve().parents[1]
    / 'app'
    / 'sales_engine'
    / 'config'
    / 'gemstone_product_catalog.json'
)

_ACCOUNT_ALIASES = {
    'JEWELS SALES ACCOUNT - COLOR STONES': 'Jewels sales account - Color stones',
    'JEWELS SALES ACCOUNT - EMERALDS': 'Jewels sales account - Emeralds',
    'JEWELS SALES ACCOUNT - PEARLS': 'Jewels sales account - Pearls',
    'JEWELS SALES ACCOUNT - RUBIES': 'Jewels sales account - Rubies',
}


def _expand_catalog_rows() -> list[tuple[str, str, float]]:
    data = json.loads(_CATALOG_PATH.read_text(encoding='utf-8'))
    rows: list[tuple[str, str, float]] = []
    accounts = data.get('accounts') or {}

    color = accounts.get('JEWELS SALES ACCOUNT - COLOR STONES') or {}
    for name in color.get('customer_products') or []:
        rows.append(('JEWELS SALES ACCOUNT - COLOR STONES', name, 100.0))
    for n in color.get('precious_stones_jos') or []:
        rows.append(('JEWELS SALES ACCOUNT - COLOR STONES', f'Precious stones JOS {n}', float(n)))
    for n in color.get('precious_stones_loose_jos') or []:
        rows.append(
            ('JEWELS SALES ACCOUNT - COLOR STONES', f'Precious stones Loose JOS {n}', float(n))
        )
    for n in color.get('semi_precious_jsp') or []:
        rows.append(('JEWELS SALES ACCOUNT - COLOR STONES', f'Semi precious JSP {n}', float(n)))
    for n in color.get('synthetic_jsy') or []:
        rows.append(('JEWELS SALES ACCOUNT - COLOR STONES', f'Synthetic JSY {n}', float(n)))

    em = accounts.get('JEWELS SALES ACCOUNT - EMERALDS') or {}
    for name in em.get('customer_products') or []:
        rows.append(('JEWELS SALES ACCOUNT - EMERALDS', name, 100.0))
    for n in em.get('emeralds_jem') or []:
        rows.append(('JEWELS SALES ACCOUNT - EMERALDS', f'Emeralds JEM {n}', float(n)))
    for name in em.get('tail_products') or []:
        rate = 22000.0 if 'LOOSE' in name.upper() else 100.0
        rows.append(('JEWELS SALES ACCOUNT - EMERALDS', name, rate))

    pe = accounts.get('JEWELS SALES ACCOUNT - PEARLS') or {}
    for name in pe.get('customer_products') or []:
        rows.append(('JEWELS SALES ACCOUNT - PEARLS', name, 100.0))
    for n in pe.get('pearls_jps') or []:
        rows.append(('JEWELS SALES ACCOUNT - PEARLS', f'Pearls JPS {n}', float(n)))

    ru = accounts.get('JEWELS SALES ACCOUNT - RUBIES') or {}
    for name in ru.get('customer_products') or []:
        rows.append(('JEWELS SALES ACCOUNT - RUBIES', name, 100.0))
    for n in ru.get('rubies_jru') or []:
        rows.append(('JEWELS SALES ACCOUNT - RUBIES', f'Rubies JRU {n}', float(n)))
    for name in ru.get('tail_products') or []:
        rate = 33500.0 if 'LOOSE' in name.upper() else 100.0
        rows.append(('JEWELS SALES ACCOUNT - RUBIES', name, rate))

    return rows


_CATALOG_ROWS = _expand_catalog_rows()


@pytest.mark.parametrize('account,product,unit_rate', _CATALOG_ROWS)
def test_gemstone_catalog_product_validates(account: str, product: str, unit_rate: float):
    proc = SalesAuditProcessor()
    upload_account = _ACCOUNT_ALIASES[account]
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='GEM-CAT',
                    sales_account=upload_account,
                    product=product,
                    unit_rate=unit_rate,
                )
            ]
        )
    )
    assert out['errorRows'] == 0, (account, product, out['records'])


def test_synthetic_jsy_rate_validation_source():
    proc = SalesAuditProcessor()
    out = proc.process(
        _wb_bytes(
            [
                _row(
                    voucher='JSY',
                    sales_account='Jewels sales account - Color stones',
                    product='Synthetic JSY 150',
                    unit_rate=150,
                )
            ]
        )
    )
    assert out['errorRows'] == 0

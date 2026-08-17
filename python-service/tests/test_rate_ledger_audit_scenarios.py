"""Scenario tests for Rate and Ledger Audit — documents common pass/fail patterns.

Run: python -m pytest tests/test_rate_ledger_audit_scenarios.py -v
"""

from __future__ import annotations

import pytest

from app.engines.sales_engine.engine.processor import SalesAuditProcessor
from app.engines.sales_engine.config.loader import load_metal_rate_rule_book_config
from tests.test_sales_audit_processor import _row, _wb_bytes


def _book_rate(product: str) -> float | None:
    book = load_metal_rate_rule_book_config()
    entry = book.get(product)
    if not entry or not isinstance(entry, dict):
        return None
    return entry.get('min_rate') or entry.get('max_rate')


def _process(*rows):
    return SalesAuditProcessor().process(_wb_bytes(list(rows)))


class TestRateLedgerScenarios:
    """Documented scenarios matching RATE_AND_LEDGER_AUDIT_README.md."""

    def test_gold_22k_in_band_rate_passes(self):
        rate = _book_rate('Gold Ornaments 22K') or 9000.0
        out = _process(
            _row(
                voucher='G-OK',
                sales_account='Gold Sales Account - 22k',
                product='Gold Ornaments 22K',
                unit_rate=rate,
                uom='Grams',
            )
        )
        assert out['errorRows'] == 0

    def test_gold_22k_stale_rate_fails_deviation(self):
        """Most common bulk error: invoice rate above Rate Rule Book band."""
        book = _book_rate('Gold Ornaments 22K') or 9000.0
        stale_rate = book * 1.61  # well outside ±15%
        out = _process(
            _row(
                voucher='G-STALE',
                sales_account='Gold Sales Account - 22k',
                product='Gold Ornaments 22K',
                unit_rate=stale_rate,
                uom='Grams',
            )
        )
        assert out['errorRows'] == 1
        assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']

    def test_gold_22k_wrong_uom_carats(self):
        out = _process(
            _row(
                voucher='G-UOM',
                sales_account='Gold Sales Account - 22k',
                product='Gold Ornaments 22K',
                unit_rate=_book_rate('Gold Ornaments 22K') or 9000,
                uom='Carats',
            )
        )
        assert out['errorRows'] == 1
        assert 'INVALID_UOM' in out['records'][0]['issues']

    def test_pearls_jps_grams_passes(self):
        out = _process(
            _row(
                voucher='P-OK',
                sales_account='Jewels sales account - Pearls',
                product='Pearls JPS 2000',
                unit_rate=2000,
                uom='Grams',
            )
        )
        assert out['errorRows'] == 0

    def test_pearls_jps_carats_fails_uom(self):
        out = _process(
            _row(
                voucher='P-BAD',
                sales_account='Jewels sales account - Pearls',
                product='Pearls JPS 2000',
                unit_rate=2000,
                uom='Carats',
            )
        )
        assert out['errorRows'] == 1
        assert out['records'][0]['issues'] == ['INVALID_UOM']

    def test_black_beads_fractional_rate_passes(self):
        out = _process(
            _row(
                voucher='BB-OK',
                sales_account='Gold Sales Account - 22k',
                product='Black beads',
                unit_rate=0.5,
                uom='Grams',
            )
        )
        assert out['errorRows'] == 0

    def test_black_beads_full_rate_fails_range(self):
        out = _process(
            _row(
                voucher='BB-BAD',
                sales_account='Gold Sales Account - 22k',
                product='Black beads',
                unit_rate=500,
                uom='Grams',
            )
        )
        assert out['errorRows'] == 1
        assert out['records'][0]['issues'] == ['INVALID_UNIT_RATE_RANGE']

    def test_cross_account_pearls_on_rubies_fails_mapping(self):
        out = _process(
            _row(
                voucher='X-MAP',
                sales_account='Jewels sales account - Rubies',
                product='Pearls JPS 2000',
                unit_rate=2000,
                uom='Grams',
            )
        )
        assert out['errorRows'] == 1
        assert 'INVALID_PRODUCT_MAPPING' in out['records'][0]['issues']

    def test_emerald_rate_above_slab_fails_deviation(self):
        out = _process(
            _row(
                voucher='E-DEV',
                sales_account='Jewels sales account - Emeralds',
                product='Emeralds JEM 5000',
                unit_rate=8000,
                uom='Carats',
            )
        )
        assert out['errorRows'] == 1
        assert out['records'][0]['issues'] == ['INVALID_RATE_DEVIATION']

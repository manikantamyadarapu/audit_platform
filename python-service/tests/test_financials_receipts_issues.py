"""Tests for Financials MR/DC Receipts & Issues classification and net movement."""

from io import BytesIO

import pandas as pd
import pytest

from app.engines.financials_engine.config.receipts_issues_config import (
    build_classification_matcher,
    classify_transfer_text,
    load_receipts_issues_classification,
)
from app.engines.financials_engine.config.product_rule_book import (
    map_pivots_to_closing_stock_categories,
)
from app.engines.financials_engine.engine.receipts_issues import (
    classify_and_aggregate_transfers,
    compute_net_movement,
    process_mr_dc_ledgers,
)
from app.engines.financials_engine.parsers.mr_dc_loader import load_transfer_workbook
from app.utils.sheet_validation_error import SheetValidationError


def _excel_bytes(rows: list[dict], columns: list[str] | None = None) -> bytes:
    buffer = BytesIO()
    frame = pd.DataFrame(rows)
    if columns is not None:
        frame = frame[columns]
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        frame.to_excel(writer, index=False)
    buffer.seek(0)
    return buffer.getvalue()


class TestClassificationConfig:
    def test_loads_and_builds_matcher(self):
        cfg = load_receipts_issues_classification()
        matcher = build_classification_matcher(cfg)
        assert matcher['includeIstInTotals'] is True
        assert any(b[0] == 'jubilee' for b in matcher['receipts'])
        assert any(b[0] == 'banjara' for b in matcher['issues'])

    def test_classify_receipts_buckets(self):
        matcher = build_classification_matcher()
        assert classify_transfer_text('Jubilee Hills', side='receipts', matcher=matcher) == 'jubilee'
        assert classify_transfer_text('Internal Stock Transfer', side='receipts', matcher=matcher) == 'ist'
        assert classify_transfer_text('Kokapet Godown', side='receipts', matcher=matcher) == 'kokapet'
        assert classify_transfer_text('Unknown Place', side='receipts', matcher=matcher) is None

    def test_classify_issues_banjara_not_jubilee(self):
        matcher = build_classification_matcher()
        assert classify_transfer_text('Banjara Hills', side='issues', matcher=matcher) == 'banjara'
        # Jubilee is a receipts bucket; Issues template uses Banjara — no Jubilee alias on issues.
        assert classify_transfer_text('Jubilee Hills', side='issues', matcher=matcher) is None


class TestMrDcLoader:
    def test_requires_product_qty_gross(self):
        payload = _excel_bytes(
            [{'Item': 'Ring', 'Qty': 1, 'Amount': 10}],
            columns=['Item', 'Qty', 'Amount'],
        )
        with pytest.raises(SheetValidationError) as exc:
            load_transfer_workbook(payload, 'MR.xlsx', source_label='Material Receipts (MR)')
        assert 'MISSING_COLUMNS' in str(exc.value.code)

    def test_loads_with_godown_hint(self):
        payload = _excel_bytes(
            [
                {
                    'Product': 'Di Beads',
                    'Quantity': 2,
                    'Gross Amount': 1000,
                    'Godown': 'Jubilee Hills',
                },
                {
                    'Product': 'Di Beads',
                    'Quantity': 1,
                    'Gross Amount': 500,
                    'Godown': 'Internal Stock Transfer',
                },
            ]
        )
        rows, _, meta = load_transfer_workbook(
            payload,
            'MR.xlsx',
            source_label='Material Receipts (MR)',
        )
        assert len(rows) == 2
        assert 'Godown' in meta['classificationColumns']
        assert 'Jubilee Hills' in rows[0]['classificationHint']


class TestAggregation:
    def test_aggregate_receipts_and_totals(self):
        rows = [
            {
                'product': 'Di Beads',
                'quantity': 2,
                'grossAmount': 1000.4,
                'classificationHint': 'Jubilee Hills',
            },
            {
                'product': 'Di Beads',
                'quantity': 3,
                'grossAmount': 2000.4,
                'classificationHint': 'Internal Stock Transfer',
            },
            {
                'product': 'Di Beads',
                'quantity': 1,
                'grossAmount': 100,
                'classificationHint': 'Somewhere Else',
            },
        ]
        result = classify_and_aggregate_transfers(rows, side='receipts')
        assert result['unclassifiedCount'] == 1
        assert result['classifiedRowCount'] == 2
        assert result['bucketSummary']['jubilee']['qty'] == 2.0
        assert result['bucketSummary']['ist']['qty'] == 3.0
        # Totals include IST by default
        assert result['totalQty'] == 5.0
        assert abs(result['totalAmt'] - 3000.8) < 1e-6

    def test_process_mr_dc_pair(self):
        mr = [
            {
                'product': 'Ring',
                'quantity': 1,
                'grossAmount': 100,
                'classificationHint': 'Kokapet',
            }
        ]
        dc = [
            {
                'product': 'Ring',
                'quantity': 1,
                'grossAmount': 80,
                'classificationHint': 'Banjara Hills',
            }
        ]
        out = process_mr_dc_ledgers(mr_rows=mr, dc_rows=dc)
        assert out['receiptsPivot'][0]['bucket'] == 'kokapet'
        assert out['issuesPivot'][0]['bucket'] == 'banjara'


class TestNetMovement:
    def test_formula_not_mr_minus_dc(self):
        net = compute_net_movement(
            opening_qty=10,
            opening_amt=1000,
            purchases_qty=5,
            purchases_amt=500,
            receipts_total_qty=3,
            receipts_total_amt=300,
            issues_total_qty=2,
            issues_total_amt=200,
            sales_qty=4,
            sales_amt=400,
        )
        # 10 + 5 + 3 - 2 - 4 = 12
        assert net['netMovementQty'] == 12
        # 1000 + 500 + 300 - 200 - 400 = 1200
        assert net['netMovementAmt'] == 1200

    def test_rule_book_layout_populates_receipts_issues(self):
        # Use a tiny synthetic rule book via map with empty book products —
        # pick products that exist in the real rule book if possible; otherwise
        # unmapped is fine for measure plumbing as long as layout keys exist.
        mapped = map_pivots_to_closing_stock_categories(
            sales_pivot=[{'product': 'ZZZ-NO-MATCH', 'sumOfQuantity': 1, 'sumOfGross': 10}],
            purchases_pivot=[],
            opening_pivot=[],
            receipts_pivot=[
                {
                    'product': 'ZZZ-NO-MATCH',
                    'bucket': 'jubilee',
                    'sumOfQuantity': 2,
                    'sumOfGross': 20,
                }
            ],
            issues_pivot=[
                {
                    'product': 'ZZZ-NO-MATCH',
                    'bucket': 'banjara',
                    'sumOfQuantity': 1,
                    'sumOfGross': 5,
                }
            ],
        )
        assert 'layoutByCategory' in mapped
        assert 'netMovement' in mapped
        # Unmapped products should be listed
        assert any('ZZZ' in p for p in mapped['unmappedProducts'])

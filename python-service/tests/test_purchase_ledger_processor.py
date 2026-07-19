"""Purchase ledger uses the Sales product master with Purchase Account names only."""

from io import BytesIO

import pandas as pd

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.config.loader import (
    account_product_rules,
    known_purchase_accounts,
    purchase_account_aliases,
    purchase_account_product_rules,
)
from app.sales_engine.engine.vectorized_sales_engine import VectorizedSalesEngine


def _build_purchase_workbook(rows: list[dict] | None = None) -> bytes:
    rows = rows or [
        {
            'Voucher No': 'PV001',
            'Purchase Account': 'Purchase Account - Gold 22K',
            'Party': 'Vendor A',
            'Product': 'GOLD ORNAMENTS 22K',
            'UOM': 'Grams',
            'Quantity': 10,
            'Unit Rate': 9000,
        }
    ]
    buffer = BytesIO()
    pd.DataFrame(rows).to_excel(buffer, index=False)
    return buffer.getvalue()


def test_purchase_account_column_maps_to_sales_engine() -> None:
    engine = VectorizedSalesEngine()
    loaded = engine.load_sales_sheet(_build_purchase_workbook())
    assert engine._ledger_mode == 'purchase'
    assert 'sales_account' in loaded.dataframe.columns
    assert loaded.column_display_headers.get('sales_account') == 'Purchase Account'


def test_purchase_rules_derived_from_sales_identical_products() -> None:
    sales = account_product_rules()
    purchase = purchase_account_product_rules()
    assert len(sales) == len(purchase)
    for sales_account, sales_spec in sales.items():
        purchase_account = sales_account.replace('SALES ACCOUNT', 'PURCHASES ACCOUNT')
        assert purchase_account in purchase
        assert purchase[purchase_account]['patterns'] == sales_spec['patterns']
        assert purchase[purchase_account]['exact'] == sales_spec['exact']
    assert 'GOLD SALES ACCOUNT - 24K' not in known_purchase_accounts()
    assert 'GOLD PURCHASES ACCOUNT - 24K' in known_purchase_accounts()
    assert purchase_account_aliases()['PURCHASE ACCOUNT - GOLD 22K'] == (
        'GOLD PURCHASES ACCOUNT - 22K'
    )


def test_purchase_ledger_valid_mapping_passes() -> None:
    result = SalesAuditProcessor().process(_build_purchase_workbook())
    assert result['success'] is True
    assert result['totalRows'] >= 1
    issues = (result.get('records') or [{}])[0].get('issues') or []
    assert 'INVALID_PRODUCT_MAPPING' not in issues


def test_purchase_color_stones_and_rubies_match_sales_products() -> None:
    rows = [
        {
            'Voucher No': 'PV10',
            'Purchase Account': 'Jewels purchases account - Color stones',
            'Product': 'Precious stones JOS 300',
            'UOM': 'Carats',
            'Quantity': 1,
            'Unit Rate': 300,
        },
        {
            'Voucher No': 'PV11',
            'Purchase Account': 'Jewels purchases account - Color stones',
            'Product': 'Semi precious JSP 400',
            'UOM': 'Carats',
            'Quantity': 1,
            'Unit Rate': 400,
        },
        {
            'Voucher No': 'PV12',
            'Purchase Account': 'Jewels purchases account - Color stones',
            'Product': 'Semi precious JSP 450',
            'UOM': 'Carats',
            'Quantity': 1,
            'Unit Rate': 450,
        },
        {
            'Voucher No': 'PV13',
            'Purchase Account': 'Jewels purchases account - Color stones',
            'Product': 'Semi precious JSP 250',
            'UOM': 'Carats',
            'Quantity': 1,
            'Unit Rate': 250,
        },
        {
            'Voucher No': 'PV14',
            'Purchase Account': 'Jewels purchases account - Rubies',
            'Product': 'Rubies JRU 350',
            'UOM': 'Carats',
            'Quantity': 1,
            'Unit Rate': 350,
        },
    ]
    result = SalesAuditProcessor().process(_build_purchase_workbook(rows))
    by_voucher = {
        rec.get('voucherNo'): set(rec.get('issues') or []) for rec in result.get('records') or []
    }
    for row in rows:
        issues = by_voucher.get(row['Voucher No'], set())
        assert 'INVALID_PRODUCT_MAPPING' not in issues, (
            row['Voucher No'],
            row['Product'],
            issues,
        )


def test_purchase_ledger_wrong_mapping_flags() -> None:
    rows = [
        {
            'Voucher No': 'PV002',
            'Purchase Account': 'Purchase Account - Gold 22K',
            'Product': 'DI. RA 15',
            'UOM': 'Carats',
            'Quantity': 1,
            'Unit Rate': 20000,
        }
    ]
    result = SalesAuditProcessor().process(_build_purchase_workbook(rows))
    assert result['errorRows'] >= 1
    issues = result['records'][0].get('issues') or []
    assert 'INVALID_PRODUCT_MAPPING' in issues

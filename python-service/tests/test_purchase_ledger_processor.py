"""Purchase ledger column mapping reuses the sales validation engine."""

from io import BytesIO

import pandas as pd

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.sales_engine.engine.vectorized_sales_engine import VectorizedSalesEngine


def _build_purchase_workbook() -> bytes:
    rows = [
        {
            'Voucher No': 'PV001',
            'Purchase Account': 'Purchase Account - Gold 22K',
            'Party': 'Vendor A',
            'Product': 'GOLD ORNAMENTS 22K',
            'UOM': 'Grams',
            'Quantity': 10,
            'Unit Rate': 5000,
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


def test_purchase_ledger_processes_without_sales_account_column() -> None:
    processor = SalesAuditProcessor()
    result = processor.process(_build_purchase_workbook())
    assert result['success'] is True
    assert result['totalRows'] >= 1

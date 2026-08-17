"""Purchase Return audit — dedicated engine (purchase ledger mode + purchase baseline)."""

from io import BytesIO

import pandas as pd

from app.engines.purchase_return_engine.engine.header_normalization import (
    detect_purchase_return_format,
    is_purchase_return_header,
    normalize_purchase_return_dataframe,
)
from app.engines.purchase_return_engine.engine.purchase_return_audit_engine import (
    HIGHER_PURCHASE_RETURN_RATE,
    PurchaseReturnAuditEngine,
)
from app.engines.purchase_return_engine.engine.purchase_return_average_engine import (
    PRODUCT_NOT_FOUND_IN_PURCHASE,
)
from app.utils.header_cleaner import normalize_header
import polars as pl


def _build_excel_bytes(rows: list[dict]) -> bytes:
    dataframe = pd.DataFrame(rows)
    output = BytesIO()
    dataframe.to_excel(output, index=False)
    return output.getvalue()


def _stored_avg(product: str, gross: float, qty: float, account: str = '') -> list[dict]:
    return [
        {
            'product': product,
            'salesAccount': account,
            'totalGrossAmount': gross,
            'totalQuantity': qty,
            'averageRate': round(gross / qty, 4) if qty else 0,
        }
    ]


def test_detect_purchase_return_formats() -> None:
    with_ref = {
        normalize_header(h)
        for h in [
            'Voucher No',
            'Purchase Voucher No',
            'Purchase Return Account',
            'Product',
            'Unit Rate',
            'Quantity',
            'Gross Amount',
        ]
    }
    assert is_purchase_return_header(with_ref)
    assert detect_purchase_return_format(with_ref) == 'with_invoice_reference'

    standard = {
        normalize_header(h)
        for h in [
            'Voucher No',
            'Purchase Returns Account',
            'Product',
            'Unit Rate',
            'Quantity',
            'Gross Amount',
        ]
    }
    assert detect_purchase_return_format(standard) == 'standard'


def test_normalize_maps_to_purchase_account_not_sales() -> None:
    df = pl.DataFrame(
        {
            'voucher_no': ['V1'],
            'purchase_return_account': ['JEWEL PURCHASE RETURNS ACCOUNT - DIAMONDS'],
            'product': ['Di. RA 15'],
            'unit_rate': [15000.0],
            'quantity': [10.0],
            'gross_amount': [150000.0],
        }
    )
    out, headers, detected = normalize_purchase_return_dataframe(df)
    assert detected == 'standard'
    assert 'purchase_account' in out.columns
    assert 'sales_account' not in out.columns
    assert 'purchase return' not in str(out['purchase_account'][0]).lower()
    assert 'purchase' in str(out['purchase_account'][0]).lower()


def test_purchase_return_engine_compares_against_purchase_baseline() -> None:
    rows = [
        {
            'Voucher No': 'PR1',
            'Purchase Return Account': 'JEWEL PURCHASE RETURNS ACCOUNT - DIAMONDS',
            'Product': 'Di. RA 15',
            'Unit Rate': 16000,
            'Quantity': 2,
            'Gross Amount': 32000,
            'UOM': 'CTS',
        }
    ]
    workbook = _build_excel_bytes(rows)
    engine = PurchaseReturnAuditEngine()
    # Baseline avg = 15000; return avg = 16000 → higher purchase return rate
    result = engine.process(workbook, _stored_avg('Di. RA 15', 150000, 10))
    assert result['success'] is True
    assert result['fileType'] == 'purchase_return'
    assert result['summary']['higherReturnRateProducts'] == 1
    assert any(
        HIGHER_PURCHASE_RETURN_RATE in (row.get('issues') or [])
        for row in result['rateComparisonRecords']
    )


def test_purchase_return_missing_baseline_code() -> None:
    rows = [
        {
            'Voucher No': 'PR1',
            'Purchase Returns Account': 'JEWEL PURCHASE RETURNS ACCOUNT - DIAMONDS',
            'Product': 'Unknown Product XYZ',
            'Unit Rate': 1000,
            'Quantity': 1,
            'Gross Amount': 1000,
        }
    ]
    workbook = _build_excel_bytes(rows)
    result = PurchaseReturnAuditEngine().process(workbook, _stored_avg('Other', 1000, 1))
    assert any(
        PRODUCT_NOT_FOUND_IN_PURCHASE in (row.get('issues') or [])
        for row in result['productAverageComparisonRecords']
    )

"""Tests for Purchase Return → Sales Return header normalization."""

from io import BytesIO

import pandas as pd
import polars as pl

from app.sales_return_engine.engine.sales_return_audit_engine import (
    HIGHER_SALES_RETURN_RATE,
    SalesReturnAuditEngine,
    _sales_or_return_header_row_matches,
)
from app.sales_return_engine.purchase_return_header_normalization import (
    detect_purchase_return_format,
    is_purchase_return_header,
    normalize_purchase_return_dataframe,
)
from app.utils.header_cleaner import normalize_header


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


def test_detect_format_with_invoice_reference() -> None:
    labels = {
        normalize_header(h)
        for h in [
            'SNo',
            'Date',
            'Voucher No',
            'Purchase Voucher No',
            'Party',
            'Purchase Return Account',
            'Product',
            'Unit Rate',
            'Quantity',
            'Gross Amount',
        ]
    }
    assert is_purchase_return_header(labels)
    assert detect_purchase_return_format(labels) == 'with_invoice_reference'
    assert _sales_or_return_header_row_matches(labels)


def test_detect_format_standard_purchase_returns() -> None:
    labels = {
        normalize_header(h)
        for h in [
            'Voucher No',
            'Party',
            'Purchase Returns Account',
            'Product',
            'Unit Rate',
            'Quantity',
            'Gross Amount',
        ]
    }
    assert detect_purchase_return_format(labels) == 'standard'
    assert 'purchase_voucher_no' not in labels
    assert _sales_or_return_header_row_matches(labels)


def test_normalize_maps_purchase_return_account_and_null_voucher() -> None:
    df = pl.DataFrame(
        {
            'voucher_no': ['V1'],
            'purchase_returns_account': ['JEWEL PURCHASE RETURNS ACCOUNT - DIAMONDS'],
            'product': ['Di. RA 15'],
            'unit_rate': [15000.0],
            'quantity': [10.0],
            'gross_amount': [150000.0],
        }
    )
    out, headers, detected = normalize_purchase_return_dataframe(
        df,
        display_headers={'purchase_returns_account': 'Purchase Returns Account'},
    )
    assert detected == 'standard'
    assert 'sales_account' in out.columns
    assert 'purchase_returns_account' not in out.columns
    assert out['purchase_voucher_no'][0] is None
    assert out['sales_account'][0] == 'JEWEL sales ACCOUNT - DIAMONDS'
    assert headers['sales_account'] == 'Purchase Returns Account'


def test_normalize_keeps_purchase_voucher_no() -> None:
    df = pl.DataFrame(
        {
            'voucher_no': ['V1'],
            'purchase_voucher_no': ['PV-9'],
            'purchase_return_account': ['PURCHASE RETURN ACCOUNT - GOLD 22K'],
            'product': ['Gold 22K'],
            'unit_rate': [5000.0],
            'quantity': [1.0],
            'gross_amount': [5000.0],
        }
    )
    out, _headers, detected = normalize_purchase_return_dataframe(df)
    assert detected == 'with_invoice_reference'
    assert out['purchase_voucher_no'][0] == 'PV-9'
    assert out['sales_account'][0] == 'sales ACCOUNT - GOLD 22K'


def test_purchase_return_with_invoice_ref_reuses_sales_return_engine() -> None:
    rows = [
        {
            'SNo': 1,
            'Date': '01-04-2025',
            'Voucher No': 'PR1',
            'Branch': 'HQ',
            'Purchase Voucher No': 'PV100',
            'Party': 'Vendor A',
            'Purchase Return Account': 'JEWEL PURCHASE RETURN ACCOUNT - DIAMONDS',
            'Item Type': 'Diamond',
            'Other Account': '',
            'Product': 'Di. RA 15',
            'UOM': 'Carats',
            'Quantity': 10,
            'Free Quantity': 0,
            'Unit Rate': 17000,
            'Gross Amount': 170000,
            'CGST': 0,
            'SGST': 0,
            'IGST': 0,
            'GST Amount': 0,
            'Net Amount': 170000,
            'Division': 'Retail',
        }
    ]
    engine = SalesReturnAuditEngine()
    result = engine.process(
        _build_excel_bytes(rows),
        _stored_avg('Di. RA 15', 150000, 10, 'JEWEL SALES ACCOUNT - DIAMONDS'),
    )
    assert result['success'] is True
    assert result['fileType'] == 'sales_return'
    assert 'purchase_voucher_no' in (result.get('sourceColumns') or [])
    comparison = result['rateComparisonRecords']
    assert len(comparison) == 1
    assert comparison[0]['issues'] == [HIGHER_SALES_RETURN_RATE]


def test_purchase_returns_without_invoice_ref_reuses_engine() -> None:
    rows = [
        {
            'SNo': 1,
            'Date': '01-04-2025',
            'Voucher No': 'PR2',
            'Branch': 'HQ',
            'Party': 'Vendor B',
            'Purchase Returns Account': 'JEWEL PURCHASE RETURNS ACCOUNT - DIAMONDS',
            'Item Type': 'Diamond',
            'Other Account': '',
            'Product': 'Di. RA 15',
            'UOM': 'Carats',
            'Quantity': 10,
            'Free Quantity': 0,
            'Unit Rate': 15000,
            'Gross Amount': 150000,
            'CGST': 0,
            'SGST': 0,
            'IGST': 0,
            'GST Amount': 0,
            'Net Amount': 150000,
            'Division': 'Retail',
        }
    ]
    engine = SalesReturnAuditEngine()
    result = engine.process(
        _build_excel_bytes(rows),
        _stored_avg('Di. RA 15', 150000, 10, 'JEWEL SALES ACCOUNT - DIAMONDS'),
    )
    assert result['success'] is True
    assert result['rateComparisonRecords'] == []
    # Missing Purchase Voucher No is normalized to null column for the engine.
    assert 'purchase_voucher_no' in (result.get('sourceColumns') or [])


def test_existing_sales_return_upload_still_works() -> None:
    rows = [
        {
            'Voucher No': 'V2',
            'Sales Return Account': 'JEWEL SALES RETURN ACCOUNT - DIAMONDS',
            'Product': 'Di. RA 15',
            'Unit Rate': 15000,
            'Quantity': 10,
            'Gross Amount': 150000,
            'UOM': 'Carats',
        }
    ]
    engine = SalesReturnAuditEngine()
    result = engine.process(
        _build_excel_bytes(rows),
        _stored_avg('Di. RA 15', 150000, 10, 'JEWEL SALES ACCOUNT - DIAMONDS'),
    )
    assert result['success'] is True
    assert result['rateComparisonRecords'] == []
    # Sales Return files must not gain a purchase_voucher_no column.
    assert 'purchase_voucher_no' not in (result.get('sourceColumns') or [])

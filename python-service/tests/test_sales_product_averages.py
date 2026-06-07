"""Tests for product-wise average rate calculation."""

from __future__ import annotations

from io import BytesIO

import openpyxl

from app.processors.sales_audit_processor import SalesAuditProcessor


def _row(product: str, gross: float, qty: float, rate: float, account: str = 'JEWEL SALES ACCOUNT - DIAMONDS') -> list:
    return [
        '',
        '2024-01-01',
        'V-001',
        'Party A',
        account,
        '',
        product,
        'Carats',
        qty,
        0,
        rate,
        gross,
    ]


def _wb_bytes(rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(
        [
            'SNo',
            'Date',
            'Voucher No',
            'Name of the Party',
            'Sales Account',
            'Other Account',
            'Product',
            'UOM',
            'Quantity',
            'Free Quantity',
            'Unit Rate',
            'Gross Amount',
        ]
    )
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_product_average_uses_sum_gross_over_sum_quantity() -> None:
    processor = SalesAuditProcessor()
    rows = [
        _row('Di. RA 20', 84890, 6.53, 13000),
        _row('Di. RA 20', 130000, 10, 13000),
        _row('Di. RA 20', 65000, 5, 13000),
    ]
    result = processor.process(_wb_bytes(rows))
    averages = result.get('productAverages') or []
    assert len(averages) == 1
    row = averages[0]
    assert row['product'] == 'Di. RA 20'
    assert row['totalGrossAmount'] == 279890
    assert row['totalQuantity'] == 21.53
    assert row['averageRate'] == round(279890 / 21.53, 4)
    assert row['transactionCount'] == 3

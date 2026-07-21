"""Tests for product-wise average rate calculation."""

from __future__ import annotations

from io import BytesIO

import openpyxl

from app.engines.sales_engine.engine.processor import SalesAuditProcessor
from app.engines.sales_engine.engine.product_averages import build_product_average_verification_summary


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


def test_each_diamond_sku_gets_own_average() -> None:
    processor = SalesAuditProcessor()
    rows = [
        _row('Di. RA 10', 500000, 25, 20000),
        _row('Di. RA 20', 900000, 30, 30000),
        _row('Di. RA 100', 1500000, 20, 75000),
        _row('Di. RC 14', 280000, 14, 20000),
    ]
    result = processor.process(_wb_bytes(rows))
    by_product = {row['product']: row for row in result.get('productAverages') or []}

    assert len(by_product) == 4
    assert by_product['Di. RA 10']['averageRate'] == round(500000 / 25, 4)
    assert by_product['Di. RA 20']['averageRate'] == round(900000 / 30, 4)
    assert by_product['Di. RA 100']['averageRate'] == round(1500000 / 20, 4)
    assert by_product['Di. RC 14']['averageRate'] == round(280000 / 14, 4)


def test_verification_summary_counts_individual_skus() -> None:
    records = [
        {'product': 'Di. RA 10', 'productNorm': 'DI. RA 10'},
        {'product': 'Di. RA 20', 'productNorm': 'DI. RA 20'},
        {'product': 'Gold Ornaments 22K', 'productNorm': 'GOLD ORNAMENTS 22K'},
    ]
    summary = build_product_average_verification_summary(records, total_rows_processed=100)
    assert summary['totalDistinctProducts'] == 3
    assert summary['diRaProducts'] == 2
    assert summary['goldProducts'] == 1

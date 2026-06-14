from __future__ import annotations

from io import BytesIO

import pandas as pd

from app.sales_engine.exception_report import MESSAGE_COLUMN, build_sales_exception_records
from app.sales_return_engine.exception_report import build_export_metadata
from app.utils.excel_exporter import export_invalid_sales_records


def test_sales_exception_preserves_upload_columns_and_message() -> None:
    records = build_sales_exception_records(
        [
            {
                'rowNumber': 12,
                '__original_voucher_no': 'V-12',
                '__original_product': 'Gold Ring',
                '__original_quantity': '2',
                'issues': ['INVALID_UOM', 'INVALID_RATE_DEVIATION'],
            }
        ],
        source_columns=['voucher_no', 'product', 'quantity'],
        column_display_headers={
            'voucher_no': 'Voucher No',
            'product': 'Product',
            'quantity': 'Quantity',
        },
    )
    assert len(records) == 1
    assert records[0]['Voucher No'] == 'V-12'
    assert records[0]['Product'] == 'Gold Ring'
    assert records[0]['Quantity'] == '2'
    assert records[0][MESSAGE_COLUMN] == 'INVALID_UOM, INVALID_RATE_DEVIATION'


def test_sales_processor_returns_exception_records_with_display_headers() -> None:
    from tests.test_sales_audit_processor import _row, _wb_bytes
    from app.processors.sales_audit_processor import SalesAuditProcessor

    proc = SalesAuditProcessor()
    workbook = _wb_bytes(
        [
            _row(
                voucher='V-ERR',
                sales_account='Wrong Account',
                product='Pearls JPS 2900',
                unit_rate=2900,
            )
        ]
    )
    out = proc.process(workbook)
    assert out['success'] is True
    assert 'exceptionRecords' in out
    assert 'exportColumns' in out
    assert 'columnDisplayHeaders' in out
    if out['exceptionRecords']:
        sample = out['exceptionRecords'][0]
        assert MESSAGE_COLUMN in sample
        assert MESSAGE_COLUMN in out['exportColumns']
        assert any(key in sample for key in ('Product', 'Voucher No', 'product', 'voucher_no'))


def test_sales_export_single_sheet_with_all_columns() -> None:
    record = {
        'Voucher No': 'V-10',
        'Product': 'Di. RA 15',
        'Quantity': '5',
        MESSAGE_COLUMN: 'INVALID_UNIT_RATE_RANGE',
    }
    export_columns, _ = build_export_metadata(
        ['voucher_no', 'product', 'quantity'],
        {
            'voucher_no': 'Voucher No',
            'product': 'Product',
            'quantity': 'Quantity',
        },
    )
    excel_bytes = export_invalid_sales_records([record], export_columns=export_columns)
    workbook = pd.ExcelFile(BytesIO(excel_bytes))
    assert workbook.sheet_names == ['Invalid Sales Rows']
    df = pd.read_excel(BytesIO(excel_bytes), sheet_name='Invalid Sales Rows')
    assert list(df.columns) == ['Voucher No', 'Product', 'Quantity', MESSAGE_COLUMN]

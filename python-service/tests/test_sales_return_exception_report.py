from __future__ import annotations

from io import BytesIO

import pandas as pd

from app.sales_return_engine.engine.sales_return_audit_engine import (
    HIGHER_SALES_RETURN_RATE,
    HIGHER_SALES_RETURN_RATE_MSG,
    INVALID_FREE_QUANTITY,
    SalesReturnAuditEngine,
)
from app.sales_return_engine.exception_report import (
    ISSUE_COLUMN,
    MESSAGE_COLUMN,
    build_consolidated_exception_records,
    build_export_metadata,
)
from app.utils.excel_exporter import export_sales_return_exceptions


def test_consolidated_report_merges_same_product_messages() -> None:
    validation = [
        {
            'rowNumber': 5,
            '__original_product': 'Gold Ornaments 22K',
            '__original_voucher_no': 'SR-001',
            'issues': ['INVALID_UOM'],
            'messages': ['Invalid UOM for product.'],
        }
    ]
    comparison = [
        {
            'product': 'Gold Ornaments 22K',
            'issues': [HIGHER_SALES_RETURN_RATE],
            'messages': [HIGHER_SALES_RETURN_RATE_MSG],
        }
    ]
    source_columns = ['voucher_no', 'product']
    display_headers = {'voucher_no': 'Voucher No', 'product': 'Product'}

    records = build_consolidated_exception_records(
        validation,
        comparison,
        source_columns=source_columns,
        column_display_headers=display_headers,
    )
    assert len(records) == 1
    assert 'INVALID_UOM' in records[0][ISSUE_COLUMN]
    assert HIGHER_SALES_RETURN_RATE in records[0][ISSUE_COLUMN]
    assert 'Invalid UOM for product.' in records[0][MESSAGE_COLUMN]
    assert HIGHER_SALES_RETURN_RATE_MSG in records[0][MESSAGE_COLUMN]
    assert records[0]['Product'] == 'Gold Ornaments 22K'


def test_consolidated_report_deduplicates_same_row() -> None:
    duplicate = [
        {'rowNumber': 3, '__original_product': 'Ring', 'issues': ['INVALID_UOM'], 'messages': ['Bad UOM']},
        {
            'rowNumber': 3,
            '__original_product': 'Ring',
            'issues': ['INVALID_RATE_DEVIATION'],
            'messages': ['Unit rate outside allowed range.'],
        },
    ]
    records = build_consolidated_exception_records(
        duplicate,
        [],
        source_columns=['product'],
        column_display_headers={'product': 'Product'},
    )
    assert len(records) == 1
    assert 'INVALID_UOM' in records[0][ISSUE_COLUMN]
    assert 'INVALID_RATE_DEVIATION' in records[0][ISSUE_COLUMN]


def test_export_preserves_original_columns_plus_issue_message() -> None:
    record = {
        'Voucher No': 'V-10',
        'Product': 'Di. RA 15',
        'Quantity': '5',
        ISSUE_COLUMN: INVALID_FREE_QUANTITY,
        MESSAGE_COLUMN: 'Free quantity not allowed for this product.',
    }
    export_columns, header_map = build_export_metadata(
        ['voucher_no', 'product', 'quantity'],
        {
            'voucher_no': 'Voucher No',
            'product': 'Product',
            'quantity': 'Quantity',
        },
    )
    excel_bytes = export_sales_return_exceptions(
        [record],
        export_columns=export_columns,
        header_map=header_map,
    )
    df = pd.read_excel(BytesIO(excel_bytes), sheet_name='Final Exception Report')
    assert list(df.columns) == ['Voucher No', 'Product', 'Quantity', ISSUE_COLUMN, MESSAGE_COLUMN]
    assert df.iloc[0][ISSUE_COLUMN] == INVALID_FREE_QUANTITY


def test_process_includes_exception_records() -> None:
    from tests.test_sales_return_audit_verification import (
        _build_excel_bytes,
        _return_row,
        _stored_avg,
    )

    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes([_return_row('Gold Ornaments 22K', 95000, 10, 9500)])
    stored = _stored_avg('Gold Ornaments 22K', 900000, 100)
    result = engine.process(return_bytes, stored)
    assert 'exceptionRecords' in result
    assert result['summary']['exceptionRowCount'] == len(result['exceptionRecords'])
    if result['exceptionRecords']:
        sample = result['exceptionRecords'][0]
        assert ISSUE_COLUMN in sample
        assert MESSAGE_COLUMN in sample

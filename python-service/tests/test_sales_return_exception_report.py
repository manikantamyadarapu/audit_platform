from __future__ import annotations

from io import BytesIO

import pandas as pd

from app.sales_return_engine.engine.sales_return_audit_engine import (
    HIGHER_SALES_RETURN_RATE,
    INVALID_FREE_QUANTITY,
    SalesReturnAuditEngine,
)
from app.sales_return_engine.exception_report import (
    MESSAGE_COLUMN,
    build_consolidated_exception_records,
    build_export_metadata,
)
from app.utils.excel_exporter import export_sales_return_exceptions


def test_consolidated_report_merges_same_product_issues() -> None:
    validation = [
        {
            'rowNumber': 5,
            '__original_product': 'Gold Ornaments 22K',
            '__original_voucher_no': 'SR-001',
            'issues': ['INVALID_UOM'],
        }
    ]
    comparison = [
        {
            'product': 'Gold Ornaments 22K',
            'issues': [HIGHER_SALES_RETURN_RATE],
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
    assert records[0][MESSAGE_COLUMN] == 'INVALID_UOM, HIGHER_SALES_RETURN_RATE'
    assert records[0]['Product'] == 'Gold Ornaments 22K'
    assert 'Issue' not in records[0]


def test_consolidated_report_deduplicates_same_row() -> None:
    duplicate = [
        {'rowNumber': 3, '__original_product': 'Ring', 'issues': ['INVALID_UOM']},
        {'rowNumber': 3, '__original_product': 'Ring', 'issues': ['INVALID_RATE_DEVIATION']},
    ]
    records = build_consolidated_exception_records(
        duplicate,
        [],
        source_columns=['product'],
        column_display_headers={'product': 'Product'},
    )
    assert len(records) == 1
    assert records[0][MESSAGE_COLUMN] == 'INVALID_UOM, INVALID_RATE_DEVIATION'


def test_export_preserves_original_columns_plus_message() -> None:
    record = {
        'Voucher No': 'V-10',
        'Product': 'Di. RA 15',
        'Quantity': '5',
        MESSAGE_COLUMN: INVALID_FREE_QUANTITY,
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
    assert list(df.columns) == ['Voucher No', 'Product', 'Quantity', MESSAGE_COLUMN]
    assert df.iloc[0][MESSAGE_COLUMN] == INVALID_FREE_QUANTITY


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
        assert MESSAGE_COLUMN in sample
        assert 'Issue' not in sample

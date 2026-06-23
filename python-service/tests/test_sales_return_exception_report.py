from __future__ import annotations

from io import BytesIO

import pandas as pd

from app.sales_return_engine.engine.sales_return_audit_engine import (
    HIGHER_SALES_RETURN_RATE,
    SalesReturnAuditEngine,
)
from app.sales_return_engine.exception_report import (
    MESSAGE_COLUMN,
    build_consolidated_exception_records,
    build_export_metadata,
    summarize_return_validation_records,
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
    assert records[0][MESSAGE_COLUMN] == (
        'invalid UOM; Average sales return rate is higher than average sales rate.'
    )
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
    assert records[0][MESSAGE_COLUMN] == (
        'invalid UOM; Unit rate outside allowed range.'
    )
    assert records[0]['issues'] == ['INVALID_UOM', 'INVALID_RATE_DEVIATION']


def test_export_preserves_original_columns_plus_message() -> None:
    record = {
        'Voucher No': 'V-10',
        'Product': 'Di. RA 15',
        'Quantity': '5',
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
    assert list(df.columns) == ['Voucher No', 'Product', 'Quantity', MESSAGE_COLUMN]
    assert df.iloc[0][MESSAGE_COLUMN] == 'Free quantity not allowed for this product.'


def test_consolidated_report_includes_rows_without_excel_row_number() -> None:
    validation = [
        {
            'voucherNo': 'SR-100',
            'validationProduct': 'Ruby Ring',
            'unitRate': 5000,
            'parsedQuantity': 2,
            '__original_product': 'Ruby Ring',
            'issues': ['INVALID_UOM'],
        }
    ]
    records = build_consolidated_exception_records(
        validation,
        [],
        source_columns=['product'],
        column_display_headers={'product': 'Product'},
    )
    assert len(records) == 1
    assert records[0][MESSAGE_COLUMN] == 'invalid UOM'


def test_validation_summary_excludes_higher_return_rate() -> None:
    validation = [
        {'rowNumber': 1, 'issues': ['INVALID_UOM']},
        {'rowNumber': 2, 'issues': ['INVALID_RATE_DEVIATION']},
    ]
    summary = summarize_return_validation_records(validation)
    assert summary['distinctInvalidRows'] == 2
    assert summary['invalidUomRows'] == 1
    assert summary['rateDeviationViolations'] == 1


def test_exception_report_preserves_raw_sales_return_account() -> None:
    validation = [
        {
            'rowNumber': 4,
            '__original_sales_account': 'JEWEL SALES RETURN ACCOUNT - DIAMONDS',
            '__original_product': 'Di. RA 15',
            'issues': ['INVALID_UOM'],
        }
    ]
    records = build_consolidated_exception_records(
        validation,
        [],
        source_columns=['sales_account', 'product'],
        column_display_headers={
            'sales_account': 'Sales Return Account',
            'product': 'Product',
        },
    )
    assert records[0]['Sales Return Account'] == 'JEWEL SALES RETURN ACCOUNT - DIAMONDS'
    assert records[0]['Sales Return Account'] != 'JEWEL SALES ACCOUNT - DIAMONDS'


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

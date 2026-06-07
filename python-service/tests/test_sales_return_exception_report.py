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
    SALES_RETURN_EXCEPTION_COLUMNS,
    SALES_RETURN_EXCEPTION_HEADER_MAP,
    build_consolidated_exception_records,
)
from app.utils.excel_exporter import export_sales_return_exceptions


def test_consolidated_report_merges_validation_and_comparison() -> None:
    validation = [
        {
            'rowNumber': 5,
            '__original_voucher_no': 'SR-001',
            '__original_name_of_party': 'Acme Jewellers',
            '__original_sales_account': 'JEWEL SALES RETURN ACCOUNT - GOLD',
            '__original_product': 'Gold Ornaments 22K',
            '__original_quantity': '2',
            '__original_free_quantity': '0',
            '__original_unit_rate': '9500',
            '__original_gross_amount': '19000',
            '__original_uom': 'Grams',
            'issues': ['INVALID_UOM'],
            'messages': ['Invalid UOM for product category.'],
        }
    ]
    comparison = [
        {
            'product': 'Gold Ornaments 22K',
            'returnTotalGrossAmount': 95000,
            'returnTotalQuantity': 10,
            'returnAverageRate': 9500,
            'issues': [HIGHER_SALES_RETURN_RATE],
            'messages': [HIGHER_SALES_RETURN_RATE_MSG],
        }
    ]

    records = build_consolidated_exception_records(validation, comparison)
    assert len(records) == 2
    by_row = {str(r.get('rowNumber') or ''): r for r in records}
    assert by_row['5']['issues'] == 'INVALID_UOM'
    assert by_row['']['issues'] == HIGHER_SALES_RETURN_RATE


def test_consolidated_report_deduplicates_same_row() -> None:
    duplicate = [
        {'rowNumber': 3, 'issues': ['INVALID_UOM'], 'messages': ['Bad UOM']},
        {'rowNumber': 3, 'issues': ['INVALID_PRODUCT_MAPPING'], 'messages': ['Bad ledger']},
    ]
    records = build_consolidated_exception_records(duplicate, [])
    assert len(records) == 1
    assert 'INVALID_UOM' in records[0]['issues']
    assert 'INVALID_PRODUCT_MAPPING' in records[0]['issues']


def test_export_exceptions_has_required_columns() -> None:
    record = {
        'rowNumber': 10,
        'voucherNo': 'V-10',
        'party': 'Party A',
        'salesReturnAccount': 'JEWEL SALES RETURN ACCOUNT - DIAMONDS',
        'product': 'Di. RA 15',
        'quantity': 5,
        'freeQuantity': 0,
        'unitRate': 15000,
        'grossAmount': 75000,
        'uom': 'Carats',
        'issues': INVALID_FREE_QUANTITY,
        'messages': 'Unit rate must be between 0 and 1 for this product.',
    }
    excel_bytes = export_sales_return_exceptions([record])
    df = pd.read_excel(BytesIO(excel_bytes), sheet_name='Sales Return Exceptions')
    headers = list(df.columns)
    expected = [SALES_RETURN_EXCEPTION_HEADER_MAP[col] for col in SALES_RETURN_EXCEPTION_COLUMNS]
    assert headers == expected
    assert df.iloc[0]['Issue'] == INVALID_FREE_QUANTITY


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
    issues = {row['issues'] for row in result['exceptionRecords']}
    assert HIGHER_SALES_RETURN_RATE in issues
    assert result['summary']['exceptionRowCount'] == len(result['exceptionRecords'])

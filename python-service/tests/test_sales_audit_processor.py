from io import BytesIO

from openpyxl import Workbook

import pytest

from app.processors.sales_audit_processor import SalesAuditProcessor
from app.utils.sheet_validation_error import SheetValidationError


def _full_header() -> list[str]:
    base = [
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
        'CGST',
        'SGST',
        'IGST',
        'GST Amount',
        'Net Amount',
        'Manual Gross Wt.',
        'Auto Gross Wt.',
    ]
    return base


def _row(
    *,
    voucher: str,
    sales_account: str,
    product: str,
    manual_wt: object = '',
    auto_wt: object = '',
) -> list:
    hdr = _full_header()
    r = dict(zip(hdr, [''] * len(hdr), strict=True))
    r['Voucher No'] = voucher
    r['Sales Account'] = sales_account
    r['Product'] = product
    r['Manual Gross Wt.'] = manual_wt
    r['Auto Gross Wt.'] = auto_wt
    out = []
    for k in hdr:
        out.append(r[k])
    return out


def _wb_bytes(body_rows: list[list], preamble_rows: list[list[str]] | None = None) -> bytes:
    wb = Workbook()
    ws = wb.active
    if preamble_rows:
        for prow in preamble_rows:
            ws.append(prow)
    ws.append(_full_header())
    for row_values in body_rows:
        ws.append(row_values)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_sales_raises_structured_error_when_columns_incomplete():
    wb = Workbook()
    ws = wb.active
    ws.append(['Voucher No', 'Sales Account', 'Product'])
    ws.append(['V1', 'Gold Sales Account - 22k', 'Black beads'])
    buf = BytesIO()
    wb.save(buf)
    proc = SalesAuditProcessor()
    with pytest.raises(SheetValidationError) as ei:
        proc.process(buf.getvalue())
    body = ei.value.to_response()
    assert body['success'] is False
    assert body['error']['code'] == 'MISSING_REQUIRED_COLUMNS'
    assert {'manual_gross_wt', 'auto_gross_wt'} <= set(body['error']['missingColumns'])
    assert isinstance(body['error']['hints'], list)


def test_sales_detects_delayed_header_row():
    preamble = [['Sales Report - Detail'], ['From: demo']]
    proc = SalesAuditProcessor()
    b = _wb_bytes(
        [_row(voucher='V1', sales_account='Gold Sales Account - 22k', product='Black beads', manual_wt=10, auto_wt=10.1)],
        preamble_rows=preamble,
    )
    out = proc.process(b)
    assert out['success'] is True
    assert out['totalRows'] == 1
    assert out['errorRows'] == 0


def test_sales_matching_category_valid():
    proc = SalesAuditProcessor()
    b = _wb_bytes([_row(voucher='V1', sales_account='Gold Sales Account - 22k', product='Black beads', manual_wt=1, auto_wt=1.01)])
    out = proc.process(b)
    assert out['success'] is True
    assert out['errorRows'] == 0
    assert out['summary']['categoryBreakdown']['22k'] == 1


def test_sales_skip_when_sales_account_has_no_category():
    proc = SalesAuditProcessor()
    b = _wb_bytes([_row(voucher='V2', sales_account='Round Off Account', product='', manual_wt=0, auto_wt=0)])
    out = proc.process(b)
    assert out['summary']['skippedNoRule'] == 1


def test_sales_invalid_category_clash():
    proc = SalesAuditProcessor()
    b = _wb_bytes([_row(voucher='A', sales_account='Jadau Sales', product='Black beads', manual_wt=1, auto_wt=1)])
    out = proc.process(b)
    assert out['errorRows'] == 1
    issue = next(i for rec in out['records'] for i in rec['issues'])
    assert 'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT' in issue


def test_sales_conflicting_accounts_same_product():
    proc = SalesAuditProcessor()
    # Two identical lines normalize to dominant 22k account; odd row out flagged.
    b = _wb_bytes(
        [
            _row(voucher='1', sales_account='Gold Sales Account - 22k', product='Widget X', manual_wt=1, auto_wt=1),
            _row(voucher='2', sales_account='Gold Sales Account - 22k', product='Widget X', manual_wt=1, auto_wt=1),
            _row(voucher='3', sales_account='Silver Sales Account', product='Widget X', manual_wt=1, auto_wt=1),
        ]
    )
    out = proc.process(b)
    flagged = [r for r in out['records'] if 'CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT' in r['issues']]
    assert any(r['voucherNo'] == '3' for r in flagged)


def test_sales_gross_weight_tolerance():
    proc = SalesAuditProcessor()
    # default tolerance 0.5 — weights differ by 1.0
    b = _wb_bytes(
        [_row(voucher='G', sales_account='Gold Sales Account - 22k', product='916 gold ornament', manual_wt=10, auto_wt=11)]
    )
    out = proc.process(b)
    assert any('GROSS_WEIGHT_OUTSIDE_TOLERANCE' in r['issues'] for r in out['records'])


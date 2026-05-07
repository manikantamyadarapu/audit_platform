"""Sales audit processor: streaming rows, category match, unknown sales accounts."""

from io import BytesIO

from openpyxl import Workbook

from app.processors.sales_audit_processor import SalesAuditProcessor


def _sales_audit_bytes() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(['Voucher No', 'Sales Account', 'Product'])
    ws.append(['V1', 'Gold Sales Account - 22k', 'Black beads'])
    ws.append(['V2', 'Round Off Account', ''])
    ws.append(['V3', 'Silver Sales Account', 'Ornament'])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_sales_audit_keeps_rows_without_expected_category():
    proc = SalesAuditProcessor()
    out = proc.process(_sales_audit_bytes(), original_filename='sales.xlsx')
    assert out['success'] is True
    assert out['totalRows'] == 3
    assert out['summary']['total'] == 3
    assert out['summary']['categoryBreakdown']['22k'] == 1
    assert out['summary']['categoryBreakdown']['unknown'] == 2
    assert sum(out['summary']['categoryBreakdown'].values()) == 3
    assert out['rowStats']['skippedNoRule'] == 2
    vouchers = {r['voucherNo'] for r in out['records']}
    assert vouchers == {'V1', 'V2', 'V3'}
    v1 = next(r for r in out['records'] if r['voucherNo'] == 'V1')
    assert v1['expectedCategory'] == '22k'
    assert v1['predictedCategory'] == '22k'
    assert v1['status'] == 'valid'


def _wb_bytes(rows: list[list]) -> bytes:
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_sales_audit_invalid_mismatch_and_jadau():
    header = ['Voucher No', 'Sales Account', 'Product']
    body = [
        ['A', 'Jadau Sales', 'Black beads'],
        ['B', 'Gold 24k', '18k chain'],
        ['C', 'Gold 18k', 'silver chain'],
        ['D', 'Gold 14k', '22k ornament'],
    ]
    proc = SalesAuditProcessor()
    out = proc.process(_wb_bytes([header, *body]), original_filename='t.xlsx')
    assert out['errorRows'] == 4
    for r in out['records']:
        assert r['status'] == 'invalid'
        assert 'Product category does not match Sales Account' in (r.get('issues') or [])


def test_sales_audit_export_invalid_roundtrip_bytes():
    from app.utils.excel_exporter import export_invalid_sales_audit_records

    records = [
        {
            'voucherNo': 'X',
            'salesAccount': 'Gold 22k',
            'product': '18k ring',
            'expectedCategory': '22k',
            'predictedCategory': '18k',
            'status': 'invalid',
            'issues': ['Product category does not match Sales Account'],
        }
    ]
    xlsx = export_invalid_sales_audit_records(records)
    assert len(xlsx) > 100
    assert xlsx[:4] == b'PK\x03\x04'

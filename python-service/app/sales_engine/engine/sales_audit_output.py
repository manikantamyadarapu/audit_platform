"""Public sales audit row shape for API exports and Excel."""

from __future__ import annotations

from typing import Any

from app.sales_engine.validators.sales_audit_messages import format_messages_field

SALES_AUDIT_OUTPUT_COLUMNS: tuple[str, ...] = (
    'rowNumber',
    'voucherNo',
    'partyName',
    'salesAccount',
    'product',
    'unitRate',
    'issues',
    'messages',
)


def normalize_sales_audit_record(record: dict[str, Any]) -> dict[str, Any]:
    """Enterprise audit columns; keeps extra fields for debug/UI expand panels."""
    issues = list(record.get('issues') or [])
    messages = record.get('messages')
    if not messages and record.get('rateMessage'):
        messages = [record['rateMessage']]
    if isinstance(messages, str):
        messages = [messages] if messages else []

    unit = record.get('originalExcelUnitRate')
    if unit in (None, '') and record.get('unitRate') not in (None, ''):
        unit = record.get('unitRate')

    slim = {
        'rowNumber': record.get('rowNumber') or record.get('sourceExcelRowNumber'),
        'voucherNo': record.get('voucherNo') or '',
        'partyName': record.get('partyName') or '',
        'salesAccount': record.get('originalExcelSalesAccount') or record.get('salesAccount') or '',
        'product': record.get('originalExcelProduct') or record.get('product') or '',
        'unitRate': unit if unit not in (None, '') else '',
        'issues': issues,
        'messages': format_messages_field(messages if isinstance(messages, list) else []),
    }
    out = {**record, **slim}
    out['messages'] = slim['messages']
    return out


def sales_records_for_export(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_sales_audit_record(r) for r in records]

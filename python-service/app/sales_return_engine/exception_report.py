"""Consolidated sales return audit exception rows for API and Excel export."""

from __future__ import annotations

from typing import Any

from app.sales_engine.engine.record_dedup import dedupe_invalid_records_by_row_number
from app.sales_engine.validators.sales_audit_messages import format_messages_field

SALES_RETURN_EXCEPTION_COLUMNS: tuple[str, ...] = (
    'rowNumber',
    'voucherNo',
    'party',
    'salesReturnAccount',
    'product',
    'quantity',
    'freeQuantity',
    'unitRate',
    'grossAmount',
    'uom',
    'issues',
    'messages',
)

SALES_RETURN_EXCEPTION_HEADER_MAP: dict[str, str] = {
    'rowNumber': 'Row Number',
    'voucherNo': 'Voucher No',
    'party': 'Party',
    'salesReturnAccount': 'Sales Return Account',
    'product': 'Product',
    'quantity': 'Quantity',
    'freeQuantity': 'Free Quantity',
    'unitRate': 'Unit Rate',
    'grossAmount': 'Gross Amount',
    'uom': 'UOM',
    'issues': 'Issue',
    'messages': 'Message',
}


def _as_message_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if item is not None and str(item).strip()]
    if value is None or value == '':
        return []
    return [str(value)]


def _exception_row_from_validation(record: dict[str, Any]) -> dict[str, Any]:
    issues = [str(code) for code in (record.get('issues') or []) if code]
    messages = _as_message_list(record.get('messages'))
    if not messages and record.get('rateMessage'):
        messages = _as_message_list(record.get('rateMessage'))

    unit = record.get('__original_unit_rate') or record.get('originalExcelUnitRate') or record.get('unitRate')

    return {
        'rowNumber': record.get('rowNumber') or record.get('sourceExcelRowNumber') or '',
        'voucherNo': record.get('__original_voucher_no') or record.get('voucherNo') or '',
        'party': (
            record.get('__original_name_of_party')
            or record.get('nameOfParty')
            or record.get('partyName')
            or ''
        ),
        'salesReturnAccount': (
            record.get('__original_sales_account')
            or record.get('originalExcelSalesAccount')
            or record.get('salesAccount')
            or ''
        ),
        'product': (
            record.get('__original_product')
            or record.get('originalExcelProduct')
            or record.get('product')
            or ''
        ),
        'quantity': record.get('__original_quantity') or record.get('quantity') or '',
        'freeQuantity': record.get('__original_free_quantity') or record.get('freeQuantity') or '',
        'unitRate': unit if unit not in (None, '') else '',
        'grossAmount': record.get('__original_gross_amount') or record.get('grossAmount') or '',
        'uom': record.get('__original_uom') or record.get('uom') or '',
        'issues': issues,
        'messages': messages,
    }


def _exception_row_from_comparison(record: dict[str, Any]) -> dict[str, Any]:
    issues = [str(code) for code in (record.get('issues') or []) if code]
    messages = _as_message_list(record.get('messages'))

    return {
        'rowNumber': '',
        'voucherNo': '',
        'party': '',
        'salesReturnAccount': '',
        'product': record.get('product') or '',
        'quantity': record.get('returnTotalQuantity') if record.get('returnTotalQuantity') is not None else '',
        'freeQuantity': '',
        'unitRate': record.get('returnAverageRate') if record.get('returnAverageRate') is not None else '',
        'grossAmount': (
            record.get('returnTotalGrossAmount')
            if record.get('returnTotalGrossAmount') is not None
            else ''
        ),
        'uom': '',
        'issues': issues,
        'messages': messages,
    }


def _normalize_exception_record(record: dict[str, Any]) -> dict[str, Any]:
    issues = [str(code) for code in (record.get('issues') or []) if code]
    messages = _as_message_list(record.get('messages'))
    return {
        **record,
        'issues': '; '.join(issues),
        'messages': format_messages_field(messages) if messages else '',
    }


def build_consolidated_exception_records(
    return_validation_records: list[dict[str, Any]],
    rate_comparison_records: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Merge row-level return validation issues and product-level rate comparison issues
    into one deduplicated exception list.
    """
    deduped_validation, _ = dedupe_invalid_records_by_row_number(return_validation_records)
    row_exceptions = [_exception_row_from_validation(record) for record in deduped_validation]

    merged: dict[tuple[str, ...], dict[str, Any]] = {}
    for record in row_exceptions:
        row_number = record.get('rowNumber')
        if row_number not in (None, ''):
            key = ('row', str(row_number))
        else:
            key = (
                'biz',
                str(record.get('voucherNo') or '').strip().upper(),
                str(record.get('product') or '').strip().upper(),
                str(record.get('unitRate') or ''),
                str(record.get('quantity') or ''),
            )
        existing = merged.get(key)
        if existing is None:
            merged[key] = record
            continue
        issue_set: list[str] = []
        for code in list(existing.get('issues') or []) + list(record.get('issues') or []):
            text = str(code).strip()
            if text and text not in issue_set:
                issue_set.append(text)
        message_set: list[str] = []
        for message in _as_message_list(existing.get('messages')) + _as_message_list(record.get('messages')):
            if message and message not in message_set:
                message_set.append(message)
        merged[key] = {**existing, 'issues': issue_set, 'messages': message_set}

    for comparison in rate_comparison_records:
        exception = _exception_row_from_comparison(comparison)
        issues = exception.get('issues') or []
        if not issues:
            continue
        product = str(exception.get('product') or '').strip().upper()
        key = ('product', product, issues[0])
        if key in merged:
            continue
        merged[key] = exception

    ordered = list(merged.values())
    ordered.sort(
        key=lambda row: (
            0 if row.get('rowNumber') not in (None, '') else 1,
            int(row['rowNumber']) if str(row.get('rowNumber') or '').isdigit() else 10**9,
            str(row.get('product') or '').lower(),
        )
    )
    return [_normalize_exception_record(record) for record in ordered]

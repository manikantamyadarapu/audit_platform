"""Public sales audit row shape for API exports and Excel."""

from __future__ import annotations

from typing import Any

from app.engines.sales_engine.validators.sales_audit_messages import format_messages_field

SALES_AUDIT_OUTPUT_COLUMNS: tuple[str, ...] = (
    'sNo',
    'date',
    'voucherNo',
    'nameOfParty',
    'salesAccount',
    'otherAccount',
    'product',
    'uom',
    'quantity',
    'freeQuantity',
    'unitRate',
    'grossAmount',
    'cgst',
    'sgst',
    'igst',
    'gstAmount',
    'netAmount',
    'manualGrossWt',
    'autoGrossWt',
    'differenceInGrossWt',
    'pan',
    'addressProof',
    'address',
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

    unit = record.get('originalExcelUnitRate') or record.get('__original_unit_rate')
    if unit in (None, '') and record.get('unitRate') not in (None, ''):
        unit = record.get('unitRate')

    slim = {
        'sNo': record.get('__original_s_no') or record.get('sNo') or '',
        'date': record.get('__original_date') or record.get('date') or '',
        'voucherNo': record.get('__original_voucher_no') or record.get('voucherNo') or '',
        'nameOfParty': record.get('__original_name_of_party') or record.get('nameOfParty') or record.get('partyName') or '',
        'salesAccount': record.get('__original_sales_account') or record.get('originalExcelSalesAccount') or record.get('salesAccount') or '',
        'otherAccount': record.get('__original_other_account') or record.get('otherAccount') or '',
        'product': record.get('__original_product') or record.get('originalExcelProduct') or record.get('product') or '',
        'uom': record.get('__original_uom') or record.get('uom') or '',
        'quantity': record.get('__original_quantity') or record.get('quantity') or '',
        'freeQuantity': record.get('__original_free_quantity') or record.get('freeQuantity') or '',
        'unitRate': unit if unit not in (None, '') else '',
        'grossAmount': record.get('__original_gross_amount') or record.get('grossAmount') or '',
        'cgst': record.get('__original_cgst') or record.get('cgst') or '',
        'sgst': record.get('__original_sgst') or record.get('sgst') or '',
        'igst': record.get('__original_igst') or record.get('igst') or '',
        'gstAmount': record.get('__original_gst_amount') or record.get('gstAmount') or '',
        'netAmount': record.get('__original_net_amount') or record.get('netAmount') or '',
        'manualGrossWt': record.get('__original_manual_gross_wt') or record.get('manualGrossWt') or '',
        'autoGrossWt': record.get('__original_auto_gross_wt') or record.get('autoGrossWt') or '',
        'differenceInGrossWt': record.get('__original_difference_in_gross_wt') or record.get('differenceInGrossWt') or '',
        'pan': record.get('__original_pan') or record.get('pan') or '',
        'addressProof': record.get('__original_address_proof') or record.get('addressProof') or '',
        'address': record.get('__original_address') or record.get('address') or '',
        'issues': issues,
        'messages': format_messages_field(messages if isinstance(messages, list) else []),
    }
    out = {**record, **slim}
    out['messages'] = slim['messages']
    return out


def sales_records_for_export(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [normalize_sales_audit_record(r) for r in records]

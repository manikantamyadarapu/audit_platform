from __future__ import annotations

from typing import Any, Hashable

from app.engines.sales_engine.validators.sales_audit_messages import build_row_messages


def _audit_status_from_issues(issues: list[str]) -> str:
    if 'INVALID_PRODUCT_MAPPING' in issues:
        return 'INVALID_PRODUCT_MAPPING'
    if 'INVALID_RATE_DEVIATION' in issues:
        return 'INVALID_RATE_DEVIATION'
    return 'VALID'


def sales_record_dedupe_key(record: dict[str, Any]) -> Hashable:
    """
    Dedupe key for sales invalid rows.

    Never use voucher alone — repeated voucher numbers are valid (multi-line vouchers).

    Priority:
    1. Excel row number (immutable source row index)
    2. Composite business key when row number is missing
    """
    row_number = int(record.get('rowNumber') or record.get('sourceExcelRowNumber') or 0)
    if row_number > 0:
        return ('row', row_number)

    voucher = str(record.get('voucherNo') or record.get('voucherNorm') or '').strip().upper()
    product = str(record.get('validationProduct') or record.get('product') or '').strip().upper()
    amount = str(record.get('unitRate') or record.get('uploadedUnitRate') or '')
    weight = str(record.get('parsedQuantity') or record.get('quantity') or '')
    return ('biz', voucher, product, amount, weight)


def dedupe_invalid_records_by_row_number(
    records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """
    Merge API records that refer to the same Excel row (or same composite business line).

    Does NOT collapse rows that share only the same voucher number.
    """
    merged: dict[Hashable, dict[str, Any]] = {}
    for record in records:
        key = sales_record_dedupe_key(record)
        if key[0] == 'row' and key[1] <= 0:
            continue

        existing = merged.get(key)
        if existing is None:
            copy = dict(record)
            row_number = int(copy.get('rowNumber') or copy.get('sourceExcelRowNumber') or 0)
            if row_number > 0:
                copy['rowNumber'] = row_number
                copy['rowId'] = row_number
                copy['sourceExcelRowNumber'] = row_number
            issues = list(copy.get('issues') or [])
            copy['messages'] = copy.get('messages') or build_row_messages(copy, issues)
            copy['rateMessage'] = copy['messages'][0] if copy.get('messages') else ''
            merged[key] = copy
            continue

        issue_set: list[str] = []
        for code in list(existing.get('issues') or []) + list(record.get('issues') or []):
            if code and code not in issue_set:
                issue_set.append(str(code))
        existing['issues'] = issue_set
        existing['messages'] = build_row_messages({**existing, **record}, issue_set)
        existing['rateMessage'] = existing['messages'][0] if existing.get('messages') else ''
        existing['auditStatus'] = _audit_status_from_issues(issue_set)

    final = list(merged.values())
    if final and all(isinstance(k, tuple) and k[0] == 'row' for k in merged):
        final.sort(key=lambda r: int(r.get('rowNumber') or 0))
    return final, len(final)

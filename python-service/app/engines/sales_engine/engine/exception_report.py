"""Sales ledger exception report — original Excel columns + Message (business text)."""

from __future__ import annotations

from typing import Any

from app.engines.sales_engine.engine.record_dedup import dedupe_invalid_records_by_row_number
from app.engines.sales_engine.validators.sales_audit_messages import format_record_issues_as_display_messages
from app.engines.sales_return_engine.engine.exception_report import (
    MESSAGE_COLUMN,
    _as_issue_list,
    _excel_row_from_record,
    _merge_issues,
    _strip_internal_fields,
    build_export_metadata,
)

__all__ = [
    'MESSAGE_COLUMN',
    'build_export_metadata',
    'build_sales_exception_records',
]


def _message_for_record(record: dict[str, Any], issues: list[str]) -> str:
    if issues:
        return format_record_issues_as_display_messages(record, issues)
    row_messages = _as_issue_list(record.get('messages'))
    if row_messages:
        return '; '.join(row_messages)
    return ''


def _finalize_sales_row(
    excel_row: dict[str, Any],
    record: dict[str, Any],
    issues: list[str],
) -> dict[str, Any]:
    row_number = excel_row.get('_rowNumber') or record.get('rowNumber') or ''
    message = _message_for_record(record, issues)
    return {
        **excel_row,
        MESSAGE_COLUMN: message,
        'issues': list(issues),
        '_issues': issues,
        '_rowNumber': row_number,
    }


def build_sales_exception_records(
    validation_records: list[dict[str, Any]],
    *,
    source_columns: list[str],
    column_display_headers: dict[str, str],
) -> list[dict[str, Any]]:
    """One row per invalid Excel line with upload columns preserved and Message appended."""
    deduped, _ = dedupe_invalid_records_by_row_number(validation_records)
    display_headers = dict(column_display_headers or {})

    merged: dict[str, dict[str, Any]] = {}
    for record in deduped:
        row_number = record.get('rowNumber') or record.get('sourceExcelRowNumber')
        if row_number in (None, ''):
            continue
        key = str(row_number)
        excel_row = _excel_row_from_record(record, source_columns, display_headers)
        excel_row['_rowNumber'] = row_number
        issues = _as_issue_list(record.get('issues'))

        existing = merged.get(key)
        if existing is None:
            merged[key] = _finalize_sales_row(excel_row, record, issues)
            continue

        merged_issues = _merge_issues(existing, {'_issues': issues})
        merged[key] = _finalize_sales_row({**existing, **excel_row}, record, merged_issues)

    ordered = list(merged.values())
    product_header = display_headers.get('product', 'Product')
    ordered.sort(
        key=lambda row: (
            0 if str(row.get('_rowNumber') or '').isdigit() else 1,
            int(row['_rowNumber']) if str(row.get('_rowNumber') or '').isdigit() else 10**9,
            str(row.get(product_header) or '').lower(),
        )
    )
    return [_strip_internal_fields(row) for row in ordered]

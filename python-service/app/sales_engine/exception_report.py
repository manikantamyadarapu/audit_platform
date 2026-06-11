"""Sales ledger exception report — original Excel columns + Message (issue codes)."""

from __future__ import annotations

from typing import Any

from app.sales_engine.engine.record_dedup import dedupe_invalid_records_by_row_number
from app.sales_return_engine.exception_report import (
    MESSAGE_COLUMN,
    _as_issue_list,
    _excel_row_from_record,
    _finalize_row,
    _merge_issues,
    _strip_internal_fields,
    build_export_metadata,
)

__all__ = [
    'MESSAGE_COLUMN',
    'build_export_metadata',
    'build_sales_exception_records',
]


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
            merged[key] = _finalize_row(excel_row, issues)
            continue

        merged_issues = _merge_issues(existing, {'_issues': issues})
        merged[key] = _finalize_row({**existing, **excel_row}, merged_issues)

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

"""Final Sales Return exception report — original Excel columns + Message (issue codes)."""

from __future__ import annotations

import re
from typing import Any

from app.sales_engine.engine.record_dedup import dedupe_invalid_records_by_row_number

MESSAGE_COLUMN = 'Message'
# Backward-compatible alias (Issue column removed; issues live in Message only).
ISSUE_COLUMN = MESSAGE_COLUMN

SALES_RETURN_EXCEPTION_COLUMNS: tuple[str, ...] = (MESSAGE_COLUMN,)
SALES_RETURN_EXCEPTION_HEADER_MAP: dict[str, str] = {MESSAGE_COLUMN: MESSAGE_COLUMN}


def _as_issue_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if item is not None and str(item).strip()]
    if value is None or value == '':
        return []
    text = str(value).strip()
    if ',' in text:
        return [part.strip() for part in text.split(',') if part.strip()]
    if ';' in text:
        return [part.strip() for part in text.split(';') if part.strip()]
    return [text] if text else []


def _to_camel_case(snake_str: str) -> str:
    parts = snake_str.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])


def _format_issue_codes(issues: list[str]) -> str:
    return ', '.join(issues)


def _merge_issues(existing: dict[str, Any], incoming: dict[str, Any]) -> list[str]:
    issues = _as_issue_list(existing.get('_issues')) + _as_issue_list(incoming.get('_issues'))
    merged: list[str] = []
    for code in issues:
        if code and code not in merged:
            merged.append(code)
    return merged


def _column_value_from_record(record: dict[str, Any], column: str) -> Any:
    original_key = f'__original_{column}'
    if original_key in record and record.get(original_key) not in (None, ''):
        return record.get(original_key)
    camel = _to_camel_case(column)
    if camel in record and record.get(camel) not in (None, ''):
        return record.get(camel)
    if column in record and record.get(column) not in (None, ''):
        return record.get(column)
    return ''


def _excel_row_from_record(
    record: dict[str, Any],
    source_columns: list[str],
    column_display_headers: dict[str, str],
) -> dict[str, Any]:
    row: dict[str, Any] = {}
    for column in source_columns:
        display = column_display_headers.get(column, column)
        row[display] = _column_value_from_record(record, column)
    return row


def _finalize_row(row: dict[str, Any], issues: list[str]) -> dict[str, Any]:
    return {
        **row,
        MESSAGE_COLUMN: _format_issue_codes(issues),
        '_issues': issues,
        '_rowNumber': row.get('_rowNumber') or row.get('rowNumber') or '',
    }


def _product_key(record: dict[str, Any], source_columns: list[str]) -> str:
    product_col = 'product'
    if product_col in source_columns:
        return str(_column_value_from_record(record, product_col) or '').strip().upper()
    return str(record.get('__original_product') or record.get('product') or '').strip().upper()


def build_source_rows_by_product(
    enriched_rows: list[dict[str, Any]],
    source_columns: list[str],
    column_display_headers: dict[str, str],
) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in enriched_rows:
        product = _product_key(row, source_columns)
        if not product:
            continue
        excel_row = _excel_row_from_record(row, source_columns, column_display_headers)
        row_number = row.get('__source_excel_row_number') or row.get('source_excel_row_number')
        excel_row['_rowNumber'] = row_number
        grouped.setdefault(product, []).append(excel_row)
    return grouped


def build_consolidated_exception_records(
    return_validation_records: list[dict[str, Any]],
    rate_comparison_records: list[dict[str, Any]],
    *,
    source_columns: list[str] | None = None,
    column_display_headers: dict[str, str] | None = None,
    source_rows_by_product: dict[str, list[dict[str, Any]]] | None = None,
) -> list[dict[str, Any]]:
    """
    Build the single final exception dataset:
    - all original upload columns (display headers)
    - Message appended at the end (comma-separated issue codes only)
    - validation + rate comparison merged without duplicate Excel rows
    """
    columns = list(source_columns or [])
    display_headers = dict(column_display_headers or {})
    if not columns:
        columns = _infer_source_columns(return_validation_records, source_rows_by_product)
    if not display_headers:
        display_headers = {column: _titleize_column(column) for column in columns}

    deduped_validation, _ = dedupe_invalid_records_by_row_number(return_validation_records)

    merged: dict[str, dict[str, Any]] = {}
    for record in deduped_validation:
        row_number = record.get('rowNumber') or record.get('sourceExcelRowNumber')
        if not row_number:
            continue
        key = str(row_number)
        excel_row = _excel_row_from_record(record, columns, display_headers)
        excel_row['_rowNumber'] = row_number
        issues = _as_issue_list(record.get('issues'))

        existing = merged.get(key)
        if existing is None:
            merged[key] = _finalize_row(excel_row, issues)
            continue
        merged_issues = _merge_issues(existing, {'_issues': issues})
        merged[key] = _finalize_row({**existing, **excel_row}, merged_issues)

    for comparison in rate_comparison_records:
        comparison_issues = _as_issue_list(comparison.get('issues'))
        if not comparison_issues:
            continue
        product = str(comparison.get('product') or '').strip().upper()
        if not product:
            continue

        comparison_payload = {'_issues': comparison_issues}

        matched_keys = [
            key
            for key, row in merged.items()
            if _product_key_from_final_row(row, columns, display_headers) == product
        ]

        if matched_keys:
            for key in matched_keys:
                existing = merged[key]
                merged_issues = _merge_issues(existing, comparison_payload)
                merged[key] = _finalize_row(existing, merged_issues)
            continue

        source_candidates = (source_rows_by_product or {}).get(product) or []
        if source_candidates:
            template = dict(source_candidates[0])
        else:
            template = {
                display_headers.get('product', 'Product'): comparison.get('product') or '',
            }

        row_number = template.get('_rowNumber') or ''
        key = str(row_number) if row_number not in (None, '') else f'product:{product}'
        merged[key] = _finalize_row(template, comparison_issues)

    ordered = list(merged.values())
    ordered.sort(
        key=lambda row: (
            0 if str(row.get('_rowNumber') or '').isdigit() else 1,
            int(row['_rowNumber']) if str(row.get('_rowNumber') or '').isdigit() else 10**9,
            str(row.get(display_headers.get('product', 'Product')) or '').lower(),
        )
    )
    return [_strip_internal_fields(row) for row in ordered]


def build_export_metadata(
    source_columns: list[str],
    column_display_headers: dict[str, str],
) -> tuple[list[str], dict[str, str]]:
    export_columns = [column_display_headers.get(col, _titleize_column(col)) for col in source_columns]
    export_columns.append(MESSAGE_COLUMN)
    header_map = {col: col for col in export_columns}
    return export_columns, header_map


def _infer_source_columns(
    validation_records: list[dict[str, Any]],
    source_rows_by_product: dict[str, list[dict[str, Any]]] | None,
) -> list[str]:
    keys: list[str] = []
    seen: set[str] = set()
    for record in validation_records:
        for key in record:
            if not key.startswith('__original_'):
                continue
            column = key.replace('__original_', '', 1)
            if column not in seen:
                seen.add(column)
                keys.append(column)
    if keys:
        return keys
    if source_rows_by_product:
        sample = next(iter(source_rows_by_product.values()), [])
        if sample:
            return list(sample[0].keys())
    return []


def _product_key_from_final_row(
    row: dict[str, Any],
    source_columns: list[str],
    column_display_headers: dict[str, str],
) -> str:
    product_header = column_display_headers.get('product', 'Product')
    return str(row.get(product_header) or '').strip().upper()


def _titleize_column(column: str) -> str:
    text = column.replace('_', ' ').strip()
    return re.sub(r'\b\w', lambda match: match.group(0).upper(), text)


def _strip_internal_fields(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if not str(key).startswith('_')}


# Legacy alias
build_final_exception_report = build_consolidated_exception_records

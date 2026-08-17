"""Purchase Return exception report — reuses Sales Return consolidators with purchase messages."""

from __future__ import annotations

from typing import Any

from app.engines.sales_return_engine.engine import exception_report as base

PURCHASE_RETURN_ISSUE_MESSAGES: dict[str, str] = {
    **base.SALES_RETURN_ISSUE_MESSAGES,
    'INVALID_LEDGER_MAPPING': 'Invalid purchase return ledger mapping.',
    'HIGHER_PURCHASE_RETURN_RATE': 'Average purchase return rate is higher than average purchase rate.',
    'PRODUCT_NOT_FOUND_IN_PURCHASE': 'Product not found in Purchase Audit file.',
    'HIGHER_SALES_RETURN_RATE': 'Average purchase return rate is higher than average purchase rate.',
}


def build_export_metadata(
    source_columns: list[str],
    column_display_headers: dict[str, str],
) -> tuple[list[str], dict[str, str]]:
    return base.build_export_metadata(source_columns, column_display_headers)


def build_source_rows_by_product(
    rows: list[dict[str, Any]],
    columns: list[str],
    column_display_headers: dict[str, str],
) -> dict[str, list[dict[str, Any]]]:
    return base.build_source_rows_by_product(rows, columns, column_display_headers)


def summarize_return_validation_records(records: list[dict[str, Any]]) -> dict[str, Any]:
    return base.summarize_return_validation_records(records)


def _rewrite_purchase_messages(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for record in records:
        issues = record.get('_issues') or record.get('issues') or []
        if isinstance(issues, str):
            issues = [part.strip() for part in issues.replace(';', ',').split(',') if part.strip()]
        messages: list[str] = []
        for code in issues:
            msg = PURCHASE_RETURN_ISSUE_MESSAGES.get(str(code), str(code))
            if msg and msg not in messages:
                messages.append(msg)
        updated = dict(record)
        if messages:
            updated[base.MESSAGE_COLUMN] = '; '.join(messages)
            if 'messages' in updated:
                updated['messages'] = messages
        # Prefer purchase wording when Message still has sales-return mapping text
        msg = str(updated.get(base.MESSAGE_COLUMN) or '')
        if 'sales return ledger mapping' in msg.lower():
            updated[base.MESSAGE_COLUMN] = PURCHASE_RETURN_ISSUE_MESSAGES['INVALID_LEDGER_MAPPING']
        out.append(updated)
    return out


def build_consolidated_exception_records(
    validation_issues: list[dict[str, Any]],
    comparison_issues: list[dict[str, Any]],
    *,
    source_columns: list[str] | None = None,
    column_display_headers: dict[str, str] | None = None,
    source_rows_by_product: dict[str, list[dict[str, Any]]] | None = None,
) -> list[dict[str, Any]]:
    records = base.build_consolidated_exception_records(
        validation_issues,
        comparison_issues,
        source_columns=source_columns,
        column_display_headers=column_display_headers,
        source_rows_by_product=source_rows_by_product,
    )
    return _rewrite_purchase_messages(records)

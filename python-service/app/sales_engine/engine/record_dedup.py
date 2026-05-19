from __future__ import annotations

from typing import Any

from app.utils.constants import SALES_ISSUE_MESSAGES


def _audit_status_from_issues(issues: list[str]) -> str:
    if 'INVALID_PRODUCT_MAPPING' in issues:
        return 'INVALID_PRODUCT_MAPPING'
    if 'INVALID_RATE_DEVIATION' in issues:
        return 'INVALID_RATE_DEVIATION'
    return 'VALID'


def dedupe_invalid_records_by_row_number(
    records: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """Merge multiple API records that share the same Excel rowNumber into one row."""
    merged: dict[int, dict[str, Any]] = {}
    for record in records:
        row_number = int(record.get('rowNumber') or record.get('sourceExcelRowNumber') or 0)
        if row_number <= 0:
            continue
        existing = merged.get(row_number)
        if existing is None:
            merged[row_number] = dict(record)
            merged[row_number]['rowNumber'] = row_number
            merged[row_number]['rowId'] = row_number
            merged[row_number]['sourceExcelRowNumber'] = row_number
            continue

        issue_set: list[str] = []
        for code in list(existing.get('issues') or []) + list(record.get('issues') or []):
            if code and code not in issue_set:
                issue_set.append(str(code))
        existing['issues'] = issue_set
        existing['messages'] = [SALES_ISSUE_MESSAGES.get(code, code) for code in issue_set]
        existing['auditStatus'] = _audit_status_from_issues(issue_set)

    final = [merged[key] for key in sorted(merged)]
    return final, len(final)

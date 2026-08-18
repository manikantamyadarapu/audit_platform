"""Validator for Negative Bank Audit."""

from typing import Any

from app.engines.cash_ledger_engine.config.constants import REQUIRED_COLUMNS
from app.engines.cash_ledger_engine.engine.utils import build_issue_summary
from app.engines.negative_bank_engine.config.constants import ISSUE_MESSAGES, ISSUE_NEGATIVE_BANK
from app.engines.negative_bank_engine.engine.rules import apply_all_rules
from app.utils.date_utils import days_since_transaction, format_till_date


def validate_required_columns(data_columns: set[str]) -> tuple[bool, list[str]]:
    """Validate that all required columns are present (same as Cash Ledger schema)."""
    missing = sorted(REQUIRED_COLUMNS - set(data_columns))
    return len(missing) == 0, missing


def validate_row(
    row: dict[str, Any],
    row_number: int,
    data_columns: list[str],
) -> dict[str, Any]:
    """Validate a single row and return record with issues + Till Date."""
    issue_codes = apply_all_rules(row)

    record: dict[str, Any] = {
        'rowNumber': row_number,
    }

    for col in data_columns:
        record[col] = row.get(col)

    if issue_codes:
        record['issues'] = issue_codes
        messages = [ISSUE_MESSAGES.get(code, '') for code in issue_codes]
        record['Message'] = '; '.join(message for message in messages if message)
        if ISSUE_NEGATIVE_BANK in issue_codes:
            till_date = format_till_date(days_since_transaction(row.get('date')))
            if till_date is not None:
                record['tillDate'] = till_date

    return record


def validate_dataframe(
    dataframe_data: list[dict[str, Any]],
    data_columns: list[str],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Validate entire dataframe and return records with summary."""
    records: list[dict[str, Any]] = []
    all_issues: list[list[str]] = []

    for row in dataframe_data:
        row_number = int(
            row.get('source_excel_row_number')
            or row.get('__excel_row_number__')
            or 0
        )
        if row_number <= 0:
            continue
        record = validate_row(row, row_number, data_columns)

        if 'issues' in record:
            records.append(record)
            all_issues.append(record['issues'])

    total_rows = len(dataframe_data)
    failed_rows = len(records)
    passed_rows = total_rows - failed_rows
    issues_by_type = build_issue_summary(all_issues)

    summary: dict[str, Any] = {
        'totalRows': total_rows,
        'passedRows': passed_rows,
        'failedRows': failed_rows,
        'totalIssues': sum(issues_by_type.values()),
        'issuesByType': issues_by_type,
    }

    return records, summary

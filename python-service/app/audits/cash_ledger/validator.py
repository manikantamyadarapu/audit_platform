"""Validator for Cash Ledger Audit."""

from typing import Any

from app.audits.cash_ledger.constants import (
    ISSUE_MESSAGES,
    ISSUE_SEVERITY,
    REQUIRED_COLUMNS,
)
from app.audits.cash_ledger.rules import apply_all_rules
from app.audits.cash_ledger.utils import build_issue_summary


def validate_required_columns(data_columns: set[str]) -> tuple[bool, list[str]]:
    """
    Validate that all required columns are present.
    
    Returns:
        Tuple of (is_valid, list_of_missing_columns)
    """
    missing = sorted(REQUIRED_COLUMNS - set(data_columns))
    return len(missing) == 0, missing


def validate_row(
    row: dict[str, Any],
    row_number: int,
    data_columns: list[str],
) -> dict[str, Any]:
    """
    Validate a single row and return record with issues.
    
    Args:
        row: Dictionary containing row data
        row_number: Excel row number (1-indexed)
        data_columns: List of column names to include in output
    
    Returns:
        Dictionary with row number, original data, and issues
    """
    # Apply business rules
    issue_codes = apply_all_rules(row)
    
    # Build record
    record: dict[str, Any] = {
        'rowNumber': row_number,
    }
    
    # Add all original columns
    for col in data_columns:
        record[col] = row.get(col)
    
    # Add issues if any
    if issue_codes:
        record['issues'] = issue_codes
        record['issueCode'] = issue_codes[0] if issue_codes else None
        record['message'] = ISSUE_MESSAGES.get(issue_codes[0], '')
        record['severity'] = ISSUE_SEVERITY.get(issue_codes[0], 'Medium')
    
    return record


def validate_dataframe(
    dataframe_data: list[dict[str, Any]],
    data_columns: list[str],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """
    Validate entire dataframe and return records with summary.
    
    Args:
        dataframe_data: List of row dictionaries
        data_columns: List of column names
    
    Returns:
        Tuple of (records, summary)
    """
    records: list[dict[str, Any]] = []
    all_issues: list[list[str]] = []
    
    for idx, row in enumerate(dataframe_data, start=2):  # Start from row 2 (assuming row 1 is header)
        record = validate_row(row, idx, data_columns)
        
        # Only keep records with issues
        if 'issues' in record:
            records.append(record)
            all_issues.append(record['issues'])
    
    # Build summary
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

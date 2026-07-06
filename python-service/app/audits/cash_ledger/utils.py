"""Utility functions for Cash Ledger Audit."""

from typing import Any


def normalize_contra_account(contra_account: str | None) -> str:
    """
    Normalize contra account string for comparison.
    
    Converts to lowercase, strips whitespace.
    """
    if not contra_account:
        return ''
    return str(contra_account).strip().lower()


def safe_float(value: Any) -> float | None:
    """
    Safely convert value to float.
    
    Returns None if conversion fails.
    """
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def build_issue_summary(issues_list: list[list[str]]) -> dict[str, int]:
    """
    Build summary of issues by type.
    
    Args:
        issues_list: List of issue code lists for each row.
    
    Returns:
        Dictionary mapping issue codes to counts.
    """
    summary: dict[str, int] = {}
    
    for issues in issues_list:
        for issue_code in issues:
            summary[issue_code] = summary.get(issue_code, 0) + 1
    
    return summary

"""Utility functions for Cash Ledger Audit."""

from __future__ import annotations

import re
from typing import Any

from app.engines.cash_ledger_engine.config.constants import (
    BANK_ACCOUNT_PHRASES,
    BANK_ACCOUNT_TOKENS,
    BANK_NAME_PHRASES,
    BANK_NAME_TOKENS,
)


def normalize_contra_account(contra_account: str | None) -> str:
    """
    Normalize contra account string for comparison.

    Converts to lowercase, strips whitespace.
    """
    if not contra_account:
        return ''
    return str(contra_account).strip().lower()


def is_bank_account(contra_account: str | None) -> bool:
    """
    Detect whether a Contra Account represents a bank account.

    Used to exclude bank deposits from Cash Payments rules.
    Comparison is case-insensitive and keyword/name based (not an
    exhaustive hard-coded list of full account titles).
    """
    normalized = normalize_contra_account(contra_account)
    if not normalized:
        return False

    for phrase in BANK_ACCOUNT_PHRASES:
        if phrase in normalized:
            return True

    for phrase in BANK_NAME_PHRASES:
        if phrase in normalized:
            return True

    tokens = set(re.findall(r'[a-z0-9]+', normalized))
    if tokens & BANK_ACCOUNT_TOKENS:
        return True
    if tokens & BANK_NAME_TOKENS:
        return True

    return False


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

"""Shared date helpers for audit Till-Date and similar day-difference calculations."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import pandas as pd


def parse_transaction_date(value: Any) -> date | None:
    """
    Parse an Excel/ledger Date cell using pandas (project date parsing).

    Supports Excel datetime cells and common string formats (day-first).
    """
    if value is None or value == '':
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, float) and pd.isna(value):
        return None

    parsed = pd.to_datetime(value, dayfirst=True, errors='coerce')
    if parsed is None or pd.isna(parsed):
        return None
    if hasattr(parsed, 'date'):
        return parsed.date()
    return pd.Timestamp(parsed).date()


def days_since_transaction(value: Any, *, today: date | None = None) -> int | None:
    """Return today − transaction date in whole days."""
    transaction_date = parse_transaction_date(value)
    if transaction_date is None:
        return None
    reference = today or date.today()
    return (reference - transaction_date).days


def format_till_date(days: int | None) -> str | None:
    """Format day difference as audit report wording, e.g. '469 Days'."""
    if days is None:
        return None
    return f'{days} Days'

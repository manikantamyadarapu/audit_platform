"""Shared row-skip heuristics for spreadsheet audits (blank / repeated header / subtotal / missing voucher)."""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

import pandas as pd

from app.utils.header_cleaner import normalize_header

SUBTOTAL_PATTERN = re.compile(
    r'(^\s*sub\s*total\b|\bgrand\s*total\b|^\s*total\s*$)',
    re.IGNORECASE,
)


def is_blank_row(row: pd.Series, normalize_empty: Callable[[Any], str | None]) -> bool:
    for value in row.values:
        if normalize_empty(value) is not None:
            return False
    return True


def is_repeated_header_row(row: pd.Series) -> bool:
    tv = row.get('total_value')
    if tv is not None and not pd.isna(tv):
        ts = str(tv).strip()
        if ts and normalize_header(ts) == 'total_value':
            return True

    na = row.get('net_amount')
    if na is not None and not pd.isna(na):
        ns = str(na).strip()
        if ns and normalize_header(ns) == 'net_amount':
            return True

    pan_raw = row.get('pan')
    if isinstance(pan_raw, str) and pan_raw.strip().upper() == 'PAN':
        pan1_raw = row.get('pan1')
        if isinstance(pan1_raw, str) and pan1_raw.strip().upper().replace(' ', '') in {'PAN1'}:
            return True

    for cell_key in ('manual_gross_weight', 'manual_gross_wt'):
        man = row.get(cell_key)
        if isinstance(man, str):
            nh = normalize_header(man)
            if nh in {'manual_gross_weight', 'manual_gross_wt'}:
                return True

    for cell_key in ('auto_gross_weight', 'auto_gross_wt'):
        auto = row.get(cell_key)
        if isinstance(auto, str):
            nh = normalize_header(auto)
            if nh in {'auto_gross_weight', 'auto_gross_wt'}:
                return True

    diff = row.get('difference')
    if isinstance(diff, str):
        nh = normalize_header(diff)
        if nh == 'difference':
            return True

    v = row.get('voucher_no')
    if isinstance(v, str) and normalize_header(v.strip()) == 'voucher_no':
        return True

    return False


def is_subtotal_row(row: pd.Series) -> bool:
    for key in ('voucher_no', 'party', 'narration', 'description'):
        if key not in row.index:
            continue
        val = row.get(key)
        if val is None or pd.isna(val):
            continue
        text = str(val).strip()
        if text and SUBTOTAL_PATTERN.search(text):
            return True
    return False


def is_missing_voucher_row(
    row: pd.Series, columns: set[str], normalize_empty: Callable[[Any], str | None]
) -> bool:
    if 'voucher_no' not in columns:
        return False
    return normalize_empty(row.get('voucher_no')) is None


def should_skip_audit_row(
    row: pd.Series,
    columns: set[str],
    *,
    normalize_empty: Callable[[Any], str | None],
    check_missing_voucher: bool = True,
) -> bool:
    if is_blank_row(row, normalize_empty):
        return True
    if is_repeated_header_row(row):
        return True
    if is_subtotal_row(row):
        return True
    if check_missing_voucher and is_missing_voucher_row(row, columns, normalize_empty):
        return True
    return False

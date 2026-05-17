from __future__ import annotations

import re
from typing import Any

import polars as pl

_HIDDEN_TEXT_PATTERN = re.compile(
    r'[\u0000-\u001f\u007f\u00a0\u1680\u180e\u2000-\u200d\u202f\u205f\u2060-\u2064\u3000\ufeff]+'
)
_SEPARATOR_PATTERN = re.compile(r'[_/|]+')
_WHITESPACE_PATTERN = re.compile(r'\s+')
_DASH_VARIANTS = '\u2010\u2011\u2012\u2013\u2014\u2015\u2212'
_LETTER_DOT_LETTER = re.compile(r'([A-Za-z])\.([A-Za-z])')
_VOUCHER_NON_ALNUM = re.compile(r'[^A-Z0-9]+')


def _space_letter_dot_letter(text: str) -> str:
    prev = None
    while prev != text:
        prev = text
        text = _LETTER_DOT_LETTER.sub(r'\1. \2', text)
    return text


def normalize_strict_text(value: object) -> str:
    if value is None:
        return ''
    text = str(value)
    text = (
        text.replace('\u2010', '-')
        .replace('\u2011', '-')
        .replace('\u2012', '-')
        .replace('\u2013', '-')
        .replace('\u2014', '-')
        .replace('\u2015', '-')
        .replace('\u2212', '-')
    )
    text = _HIDDEN_TEXT_PATTERN.sub(' ', text)
    text = _space_letter_dot_letter(text)
    text = _SEPARATOR_PATTERN.sub(' ', text)
    text = re.sub(r'\s*-\s*', ' - ', text)
    text = _WHITESPACE_PATTERN.sub(' ', text.strip())
    return text.upper()


def normalize_blankable_text(value: object) -> str | None:
    normalized = normalize_strict_text(value)
    return normalized or None


def normalize_voucher(value: object) -> str:
    """Strict voucher key: uppercase letters and digits only (no partial / substring semantics)."""
    if value is None:
        return ''
    text = str(value).upper()
    return _VOUCHER_NON_ALNUM.sub('', text)


def normalize_strict_text_expr(column: str) -> pl.Expr:
    expr = (
        pl.col(column)
        .cast(pl.Utf8, strict=False)
        .fill_null('')
        .str.replace_all(f'[{_DASH_VARIANTS}]', '-')
        .str.replace_all(
            r'[\u0000-\u001f\u007f\u00a0\u1680\u180e\u2000-\u200d\u202f\u205f\u2060-\u2064\u3000\ufeff]+',
            ' ',
        )
    )
    for _ in range(10):
        expr = expr.str.replace_all(r'([A-Za-z])\.([A-Za-z])', '$1. $2')
    return (
        expr.str.replace_all(r'[_/|]+', ' ')
        .str.replace_all(r'\s*-\s*', ' - ')
        .str.replace_all(r'\s+', ' ')
        .str.strip_chars()
        .str.to_uppercase()
    )


def normalize_blankable_text_expr(column: str) -> pl.Expr:
    expr = normalize_strict_text_expr(column)
    return pl.when(expr == '').then(None).otherwise(expr)


def normalize_voucher_expr(column: str) -> pl.Expr:
    return (
        pl.col(column)
        .cast(pl.Utf8, strict=False)
        .fill_null('')
        .str.to_uppercase()
        .str.replace_all(r'[^A-Z0-9]', '')
    )


def normalize_blankable_voucher_expr(column: str) -> pl.Expr:
    expr = normalize_voucher_expr(column)
    return pl.when(expr == '').then(None).otherwise(expr)


def parse_numeric_value(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = normalize_strict_text(value).replace(',', '')
    if not text:
        return None
    match = re.search(r'-?\d+(?:\.\d+)?', text)
    if match is None:
        return None
    return float(match.group(0))

"""Strict Decimal parsing for gross-weight audits (avoids binary float drift)."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd

_WEIGHT_QUANT = Decimal('0.01')

_EMPTY_WEIGHT_TOKENS = frozenset(
    {'', 'pending', 'na', 'n/a', 'none', 'null', 'nan', '-', '----'}
)


def parse_weight_decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, int):
        return Decimal(value)
    if isinstance(value, float):
        return Decimal(str(value))

    text = str(value).strip()
    if not text:
        return None
    low = text.lower()
    if low in _EMPTY_WEIGHT_TOKENS:
        return None
    cleaned = low.replace(',', '')
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def quantize_weight(d: Decimal) -> Decimal:
    return d.quantize(_WEIGHT_QUANT)

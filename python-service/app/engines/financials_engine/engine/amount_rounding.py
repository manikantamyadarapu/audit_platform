"""Whole-rupee rounding for Financials Amount columns on every branch."""

from __future__ import annotations

from decimal import ROUND_HALF_DOWN, Decimal
from typing import Any


def round_amount_whole(value: Any) -> int | None:
    """Round Amount in Rs. Fraction 0.5 or less stays; greater than 0.5 goes up."""
    if value is None or value == '':
        return None
    try:
        number = Decimal(str(value))
    except (ArithmeticError, ValueError, TypeError):
        return None
    if not number.is_finite():
        return None
    return int(number.quantize(Decimal('1'), rounding=ROUND_HALF_DOWN))


def round_amount_whole_float(value: Any) -> float | None:
    rounded = round_amount_whole(value)
    return None if rounded is None else float(rounded)

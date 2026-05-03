"""Gross-weight triplet rules: Decimal HALF_UP quantization (used by ``GrossWeightProcessor``)."""

import math
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

_TWO_DP = Decimal('0.01')


def to_decimal_two_dp(value: float | int | None) -> Decimal | None:
    """Quantize to cents; stable vs binary float (Excel-style amounts)."""
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    try:
        return Decimal(str(value)).quantize(_TWO_DP, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return None


def display_float_two_dp(raw: float | int | None) -> float | None:
    """UI / JSON amounts: ROUND_HALF_UP to two decimals as Python float."""
    d = to_decimal_two_dp(raw)
    if d is None:
        return None
    return float(d)


def validate_triplet(
    manual: float | int | None,
    auto: float | int | None,
    diff: float | int | None,
) -> tuple[list[str], bool, bool, bool]:
    """
    Accepts raw parsed floats (or ints) and internally quantizes using ROUND_HALF_UP.

    VALID only when quantized Manual == Auto and Difference == 0.00.
    Returns ``(issues, mismatch_manual_auto, difference_violation, diff_only_violation)``.
    """
    issues: list[str] = []
    if manual is None or auto is None or diff is None:
        issues.append('Missing weight or difference values')
        return issues, False, False, False

    m = to_decimal_two_dp(manual)
    a = to_decimal_two_dp(auto)
    d = to_decimal_two_dp(diff)
    if m is None or a is None or d is None:
        issues.append('Missing weight or difference values')
        return issues, False, False, False

    manual_match = m == a
    diff_zero = d == Decimal('0.00')
    difference_violation = not diff_zero
    diff_only_violation = manual_match and not diff_zero

    row_ok = manual_match and diff_zero
    if row_ok:
        return issues, False, False, False

    mismatch_manual_auto = not manual_match
    if mismatch_manual_auto:
        issues.append('Manual Gross and Auto Gross mismatch')
    if difference_violation:
        issues.append('Difference must be exactly 0.00')

    return issues, mismatch_manual_auto, difference_violation, diff_only_violation

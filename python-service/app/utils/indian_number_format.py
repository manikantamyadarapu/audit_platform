"""Indian numbering display formats (lakhs/crores grouping)."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from openpyxl.cell import Cell

# Excel Indian format (#,##,##0 style). Optional decimals for Qty; Amounts are whole.
# Underlying cell value stays numeric.
INDIAN_NUMBER_FORMAT = (
    '[>=10000000]##,##,##,##0.####;'
    '[>=100000]##,##,##0.####;'
    '#,##0.####'
)


def format_indian_number(
    value: float | int | None,
    *,
    max_decimals: int = 0,
) -> str:
    """Format a number for display strings using Indian grouping (#,##,##0)."""
    if value is None:
        return ''
    num = float(value)
    if num != num:  # NaN
        return ''

    sign = '-' if num < 0 else ''
    num = abs(num)
    if max_decimals <= 0:
        whole = str(int(round(num)))
        fraction = ''
    else:
        whole, _, fraction = f'{num:.{max_decimals}f}'.partition('.')
        fraction = fraction.rstrip('0')

    if len(whole) <= 3:
        grouped = whole
    else:
        last_three = whole[-3:]
        rest = whole[:-3]
        groups: list[str] = []
        while rest:
            groups.append(rest[-2:])
            rest = rest[:-2]
        groups.reverse()
        grouped = ','.join(groups + [last_three])

    if fraction:
        return f'{sign}{grouped}.{fraction}'
    return f'{sign}{grouped}'


def apply_indian_number_format(cell: Cell) -> None:
    """Apply Indian grouping (#,##,##0) to an openpyxl cell (value unchanged)."""
    cell.number_format = INDIAN_NUMBER_FORMAT

"""One-off maintenance: expand Jewels Emeralds rows in master_sales_rules.xlsx.

Run from repo root: python -m app.data.rebuild_master_emerald_rows
"""

from __future__ import annotations

from pathlib import Path

from openpyxl import load_workbook

_WORKBOOK = Path(__file__).resolve().parent / 'master_sales_rules.xlsx'

# Authoritative JEM numeric grades (uploads normalize to uppercase).
_JEM_NUMBERS: list[int] = [
    50,
    100,
    150,
    200,
    250,
    300,
    350,
    400,
    450,
    500,
    550,
    600,
    650,
    700,
    750,
    800,
    850,
    900,
    950,
    1000,
    1100,
    1200,
    1300,
    1400,
    1500,
    1600,
    1700,
    1800,
    1900,
    2000,
    2100,
    2200,
    2300,
    2400,
    2500,
    2600,
    2700,
    2800,
    3000,
    3100,
    3200,
    3300,
    3400,
    3500,
    3600,
    3700,
    3800,
    3900,
    4000,
    4100,
    4200,
    4300,
    4400,
    4500,
    4600,
    4700,
    4800,
    4900,
    5000,
    5200,
    5300,
    5600,
    5800,
    6000,
    6500,
    6700,
    6800,
    7000,
    7500,
    7800,
    8000,
    8500,
    9000,
    9500,
    10000,
    10500,
    11500,
    12000,
    12500,
    13000,
    14000,
    14500,
    15000,
    18500,
    24000,
    25000,
    30000,
    40000,
    58000,
]

_TAIL_PRODUCTS: tuple[str, ...] = (
    'Emeralds JEM Loose 22000',
    'Emeralds JEM Mix',
)


def _pad_row(values: tuple[object, ...], width: int) -> tuple[object, ...]:
    lst = list(values)
    while len(lst) < width:
        lst.append(None)
    return tuple(lst[:width])


def main() -> None:
    wb = load_workbook(_WORKBOOK)
    ws = wb.active
    max_col = ws.max_column or 4
    rows: list[tuple[object, ...]] = []
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=max_col):
        rows.append(_pad_row(tuple(c.value for c in row), max_col))

    emerald_start: int | None = None
    emerald_end: int | None = None
    for i, r in enumerate(rows):
        cell0 = r[0]
        if cell0 is None:
            continue
        s = str(cell0).strip()
        if 'jewels' in s.lower() and 'emerald' in s.lower():
            emerald_start = i
            break
    if emerald_start is None:
        raise RuntimeError('Could not find Jewels sales account - Emeralds row')

    for j in range(emerald_start + 1, len(rows)):
        r = rows[j]
        if r[0] is not None and str(r[0]).strip():
            emerald_end = j
            break
    if emerald_end is None:
        raise RuntimeError('Could not find row after Emeralds block')

    child_products: list[str] = [f'Emeralds JEM {n}' for n in _JEM_NUMBERS] + list(_TAIL_PRODUCTS)
    new_children = [_pad_row((None, name, None, None), max_col) for name in child_products]

    rebuilt = rows[: emerald_start + 1] + new_children + rows[emerald_end:]
    ws.delete_rows(1, ws.max_row)
    for r_idx, rvals in enumerate(rebuilt, start=1):
        for c_idx, val in enumerate(rvals, start=1):
            ws.cell(row=r_idx, column=c_idx, value=val)
    wb.save(_WORKBOOK)


if __name__ == '__main__':
    main()

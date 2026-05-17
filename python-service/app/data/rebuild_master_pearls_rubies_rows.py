"""Maintenance: replace Jewels Pearls / Rubies product rows in master_sales_rules.xlsx.

Run from python-service: python -m app.data.rebuild_master_pearls_rubies_rows
"""

from __future__ import annotations

from pathlib import Path

from openpyxl import load_workbook

_WORKBOOK = Path(__file__).resolve().parent / 'master_sales_rules.xlsx'

# Authoritative lists (must match enterprise master; uploads normalize to uppercase).
_JPS_NUMBERS: list[int] = [
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
    700,
    800,
    850,
    900,
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
    2400,
    2500,
    2800,
    2900,
    3500,
    4000,
    4200,
    5000,
    8400,
    33000,
]

_JRU_NUMBERS: list[int] = [
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
    2700,
    2800,
    2900,
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
    5100,
    5300,
    5400,
    5500,
    6000,
    6300,
    6600,
    7000,
    8400,
    10000,
    11200,
    14500,
    20000,
]

_RUBY_TAIL: tuple[str, ...] = (
    'Rubies JRU Loose 33500',
    'Rubies JRU Mix',
)


def _pad_row(values: tuple[object, ...], width: int) -> tuple[object, ...]:
    lst = list(values)
    while len(lst) < width:
        lst.append(None)
    return tuple(lst[:width])


def _next_account_row_index(rows: list[tuple[object, ...]], start_idx: int) -> int | None:
    for j in range(start_idx + 1, len(rows)):
        r = rows[j]
        if r[0] is not None and str(r[0]).strip():
            return j
    return None


def main() -> None:
    wb = load_workbook(_WORKBOOK)
    ws = wb.active
    max_col = ws.max_column or 4
    rows: list[tuple[object, ...]] = []
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=max_col):
        rows.append(_pad_row(tuple(c.value for c in row), max_col))

    pearl_start: int | None = None
    for i, r in enumerate(rows):
        cell0 = r[0]
        if cell0 is None:
            continue
        s = str(cell0).strip()
        if 'jewels' in s.lower() and 'pearl' in s.lower():
            pearl_start = i
            break
    if pearl_start is None:
        raise RuntimeError('Could not find Jewels sales account - Pearls row')

    pearl_end = _next_account_row_index(rows, pearl_start)
    if pearl_end is None:
        raise RuntimeError('Could not find row after Pearls block')

    ruby_start = pearl_end
    ruby_end = _next_account_row_index(rows, ruby_start)
    if ruby_end is None:
        ruby_end = len(rows)

    pearl_children = [_pad_row((None, f'Pearls JPS {n}', None, None), max_col) for n in sorted(_JPS_NUMBERS)]
    ruby_children = [_pad_row((None, f'Rubies JRU {n}', None, None), max_col) for n in sorted(_JRU_NUMBERS)] + [
        _pad_row((None, name, None, None), max_col) for name in _RUBY_TAIL
    ]

    rebuilt = (
        rows[: pearl_start + 1]
        + pearl_children
        + rows[ruby_start : ruby_start + 1]
        + ruby_children
        + rows[ruby_end:]
    )

    ws.delete_rows(1, ws.max_row)
    for r_idx, rvals in enumerate(rebuilt, start=1):
        for c_idx, val in enumerate(rvals, start=1):
            ws.cell(row=r_idx, column=c_idx, value=val)
    wb.save(_WORKBOOK)


if __name__ == '__main__':
    main()

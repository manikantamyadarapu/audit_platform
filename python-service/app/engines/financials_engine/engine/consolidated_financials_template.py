"""Consolidated Financials workbook: Abstract headers then empty TShape."""

from __future__ import annotations

from io import BytesIO
from typing import Any, Mapping

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from app.engines.financials_engine.engine.abstract_template import displayed_abstract_amount
from app.engines.financials_engine.engine.consolidated_abstract_values import (
    build_consolidated_abstract_row_measures,
)
from app.engines.financials_engine.engine.consolidated_tshape_values import (
    TSHAPE_BRANCH_COLUMNS,
    TSHAPE_LEFT_ROWS,
    TSHAPE_RIGHT_ROWS,
    _side_total,
    build_consolidated_tshape_values,
)
from app.utils.indian_number_format import apply_indian_number_format

ABSTRACT_SHEET_NAME = 'Abstract'
TSHAPE_SHEET_NAME = 'TShape'
CONSOLIDATED_SHEET_NAMES: tuple[str, str] = (ABSTRACT_SHEET_NAME, TSHAPE_SHEET_NAME)
CONSOLIDATED_ABSTRACT_TITLE = 'Trading Account Abstract'

_QTY_SUBHEADER = 'Qty in Gms / Cts'
_AMT_SUBHEADER = 'Amount in Rs'

# (heading, kind) — qty_amt: two subcolumns; amt_only: Amount in Rs; none: merged, no subheaders.
CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS: tuple[tuple[str, str], ...] = (
    ('Opening Stock', 'qty_amt'),
    ('Purchases - Total', 'qty_amt'),
    ('Internal Transfer - Total', 'qty_amt'),
    ('Internal Consumption - Total', 'qty_amt'),
    ('Making Charges', 'amt_only'),
    ('Sales - Total', 'qty_amt'),
    ('Closing Stock - Total', 'qty_amt'),
    ('Gross Profit', 'amt_only'),
    ('CY G P %', 'none'),
    ('GP AY 2025-26', 'amt_only'),
    ('Deviation', 'amt_only'),
)

# (kind, label) — spacers have no label. Measure cells stay empty.
CONSOLIDATED_ABSTRACT_BODY_ROWS: tuple[tuple[str, str | None], ...] = (
    ('spacer', None),
    ('account', 'Gold Account 24K'),
    ('account', 'Gold Account 22K'),
    ('account', 'Gold Account 18K'),
    ('account', 'Gold Account 14K'),
    ('account', 'Platinum Account'),
    ('account', 'Gold Account Jadau'),
    ('account', 'Silver Account'),
    ('account', 'Diamonds Account'),
    ('account', 'Emeralds'),
    ('account', 'Pearls'),
    ('account', 'Rubies'),
    ('account', 'Color Stones Account'),
    ('spacer', None),
    ('total', 'TOTAL'),
    ('spacer', None),
    ('spacer', None),
    ('group_heading', 'DIAMONDS'),
    ('item', 'Diamonds - Black diamonds'),
    ('item', 'Diamonds - Beads'),
    ('item', 'Diamonds Rosecut diamonds'),
    ('item', 'Diamonds - Flat polki'),
    ('item', 'Uncut - diamonds'),
    ('item', 'Diamonds'),
    ('group_total', 'Diamonds total'),
    ('spacer', None),
    ('group_heading', 'COLOR STONES'),
    ('item', 'Precious Stones'),
    ('item', 'Semi Precious'),
    ('item', 'Synthetic Stones'),
    ('group_total', 'TOTAL Colour Stones'),
)

_THIN = Border(
    left=Side(style='thin', color='94A3B8'),
    right=Side(style='thin', color='94A3B8'),
    top=Side(style='thin', color='94A3B8'),
    bottom=Side(style='thin', color='94A3B8'),
)
_T_DIVIDER = Border(
    left=Side(style='thin', color='94A3B8'),
    right=Side(style='medium', color='0F172A'),
    top=Side(style='thin', color='94A3B8'),
    bottom=Side(style='thin', color='94A3B8'),
)
_TITLE_FILL = PatternFill('solid', fgColor='CCFBF1')
_HEADER_FILL = PatternFill('solid', fgColor='0F766E')
_TITLE_FONT = Font(name='Calibri', size=12, bold=True, color='0F172A')
_HEADER_FONT = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
_GROUP_FILL = PatternFill('solid', fgColor='115E59')
_TOTAL_FILL = PatternFill('solid', fgColor='FEF3C7')
_GROUP_FONT = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
_ACCOUNT_FONT = Font(name='Calibri', size=10, color='0F172A')
_ITEM_FONT = Font(name='Calibri', size=10, color='334155')
_TOTAL_FONT = Font(name='Calibri', size=10, bold=True, color='78350F')
_CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
_LEFT = Alignment(horizontal='left', vertical='center', wrap_text=True)
_ITEM_ALIGN = Alignment(horizontal='left', vertical='center', wrap_text=True, indent=2)

_TITLE_ROW = 1
_GROUP_ROW = 2
_SUB_ROW = 3
_FIRST_BODY_ROW = 4
_PARTICULARS_COL = 1


def consolidated_abstract_column_span(kind: str) -> int:
    return 2 if kind == 'qty_amt' else 1


_LAST_COL = 1 + sum(
    consolidated_abstract_column_span(kind) for _, kind in CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS
)


def build_consolidated_financials_workbook_bytes(
    branches: Mapping[str, Any] | None = None,
) -> tuple[bytes, list[str], list[str]]:
    """Two sheets in order: Abstract then TShape."""
    by_label, contributing, unresolved = build_consolidated_abstract_row_measures(branches)
    tshape_values, tshape_unresolved = build_consolidated_tshape_values(branches)
    workbook = Workbook()
    write_consolidated_abstract_sheet(workbook.active, by_label)
    write_consolidated_tshape_sheet(workbook.create_sheet(), tshape_values)
    buffer = BytesIO()
    workbook.save(buffer)
    combined = list(unresolved)
    for item in tshape_unresolved:
        if item not in combined:
            combined.append(item)
    return buffer.getvalue(), contributing, combined


def write_consolidated_abstract_sheet(
    ws: Worksheet,
    by_label: Mapping[str, Mapping[str, Mapping[str, Any]]] | None = None,
) -> None:
    """Two-level headers, Particulars labels, and mapped Abstract values."""
    ws.title = ABSTRACT_SHEET_NAME
    ws.sheet_state = 'visible'
    ws.sheet_properties.tabColor = '0F766E'
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.freeze_panes = 'B4'

    ws.merge_cells(
        start_row=_TITLE_ROW,
        start_column=_PARTICULARS_COL,
        end_row=_TITLE_ROW,
        end_column=_LAST_COL,
    )
    title = ws.cell(row=_TITLE_ROW, column=_PARTICULARS_COL, value=CONSOLIDATED_ABSTRACT_TITLE)
    _style(title, font=_TITLE_FONT, fill=_TITLE_FILL, alignment=_CENTER)
    for col in range(_PARTICULARS_COL, _LAST_COL + 1):
        cell = ws.cell(row=_TITLE_ROW, column=col)
        cell.fill = _TITLE_FILL
        cell.border = _THIN
    ws.row_dimensions[_TITLE_ROW].height = 22

    particulars = ws.cell(row=_GROUP_ROW, column=_PARTICULARS_COL, value='Particulars')
    _style(particulars, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_LEFT)
    ws.merge_cells(
        start_row=_GROUP_ROW,
        start_column=_PARTICULARS_COL,
        end_row=_SUB_ROW,
        end_column=_PARTICULARS_COL,
    )
    sub_particulars = ws.cell(row=_SUB_ROW, column=_PARTICULARS_COL)
    _style(sub_particulars, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_LEFT)
    ws.column_dimensions['A'].width = 36

    col = 2
    for heading, kind in CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS:
        span = consolidated_abstract_column_span(kind)
        last = col + span - 1
        if kind == 'qty_amt':
            ws.merge_cells(
                start_row=_GROUP_ROW,
                start_column=col,
                end_row=_GROUP_ROW,
                end_column=last,
            )
            group_cell = ws.cell(row=_GROUP_ROW, column=col, value=heading)
            _style(group_cell, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            sibling = ws.cell(row=_GROUP_ROW, column=last)
            _style(sibling, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            qty = ws.cell(row=_SUB_ROW, column=col, value=_QTY_SUBHEADER)
            _style(qty, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            amt = ws.cell(row=_SUB_ROW, column=last, value=_AMT_SUBHEADER)
            _style(amt, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            ws.column_dimensions[get_column_letter(col)].width = 14
            ws.column_dimensions[get_column_letter(last)].width = 16
        elif kind == 'amt_only':
            group_cell = ws.cell(row=_GROUP_ROW, column=col, value=heading)
            _style(group_cell, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            amt = ws.cell(row=_SUB_ROW, column=col, value=_AMT_SUBHEADER)
            _style(amt, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            ws.column_dimensions[get_column_letter(col)].width = 16
        else:
            ws.merge_cells(
                start_row=_GROUP_ROW,
                start_column=col,
                end_row=_SUB_ROW,
                end_column=col,
            )
            group_cell = ws.cell(row=_GROUP_ROW, column=col, value=heading)
            _style(group_cell, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            sub = ws.cell(row=_SUB_ROW, column=col)
            _style(sub, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            ws.column_dimensions[get_column_letter(col)].width = 16
        col += span

    ws.row_dimensions[_GROUP_ROW].height = 24
    ws.row_dimensions[_SUB_ROW].height = 28

    for offset, (kind, label) in enumerate(CONSOLIDATED_ABSTRACT_BODY_ROWS):
        measures = (by_label or {}).get(label or '') if kind not in {'spacer', 'group_heading'} else None
        _write_body_row(ws, _FIRST_BODY_ROW + offset, kind, label, measures)


def _write_body_row(
    ws: Worksheet,
    row: int,
    kind: str,
    label: str | None,
    measures: Mapping[str, Mapping[str, Any]] | None = None,
) -> None:
    if kind == 'spacer':
        ws.row_dimensions[row].height = 12
        return

    font, fill, alignment, height = _row_style(kind)
    label_cell = ws.cell(row=row, column=_PARTICULARS_COL, value=label)
    _style(label_cell, font=font, fill=fill, alignment=alignment)
    col = 2
    for heading, column_kind in CONSOLIDATED_ABSTRACT_MEASURE_COLUMNS:
        span = consolidated_abstract_column_span(column_kind)
        for offset in range(span):
            cell = ws.cell(row=row, column=col + offset)
            _style(cell, font=font, fill=fill, alignment=_CENTER)
            pair = (measures or {}).get(heading) or {}
            if column_kind == 'qty_amt':
                if offset == 0:
                    _write_numeric(cell, pair.get('qty'))
                else:
                    _write_amount(cell, pair.get('amt'))
            elif heading == 'CY G P %':
                _write_numeric(cell, pair.get('amt'))
            else:
                _write_amount(cell, pair.get('amt'))
            if heading == 'CY G P %':
                cell.number_format = '0.00'
            else:
                apply_indian_number_format(cell)
        col += span
    ws.row_dimensions[row].height = height


def _row_style(kind: str):
    if kind == 'group_heading':
        return _GROUP_FONT, _GROUP_FILL, _LEFT, 20
    if kind == 'item':
        return _ITEM_FONT, PatternFill(), _ITEM_ALIGN, 18
    if kind in {'total', 'group_total'}:
        return _TOTAL_FONT, _TOTAL_FILL, _LEFT, 20
    return _ACCOUNT_FONT, PatternFill(), _LEFT, 18


def _write_numeric(cell, value: Any) -> None:
    if value is None or value == '':
        cell.value = None
        return
    cell.value = value


def _write_amount(cell, value: Any) -> None:
    if value is None or value == '':
        cell.value = None
        return
    cell.value = displayed_abstract_amount(value)


def _style(cell, *, font, fill, alignment) -> None:
    cell.font = font
    cell.fill = fill
    cell.alignment = alignment
    cell.border = _THIN


_TSHAPE_LEFT_PARTICULARS = 1
_TSHAPE_LEFT_FIRST = 2
_TSHAPE_GUTTER = 6
_TSHAPE_RIGHT_PARTICULARS = 7
_TSHAPE_RIGHT_FIRST = 8
_TSHAPE_HEADER_ROW = 1
_TSHAPE_FIRST_BODY_ROW = 2
_TSHAPE_BODY_ROWS = len(TSHAPE_LEFT_ROWS)


def write_consolidated_tshape_sheet(
    ws: Worksheet,
    values: Mapping[str, Mapping[str, Any]] | None = None,
) -> None:
    """Two-sided TShape: branch columns plus Total. Amounts only."""
    grid = values or {}
    ws.title = TSHAPE_SHEET_NAME
    ws.sheet_state = 'visible'
    ws.sheet_properties.tabColor = '0F766E'
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    ws.freeze_panes = 'B2'

    headers = [label for _key, label in TSHAPE_BRANCH_COLUMNS] + ['Total']
    _write_tshape_header_row(ws, _TSHAPE_LEFT_PARTICULARS, _TSHAPE_LEFT_FIRST, headers, last_border=_T_DIVIDER)
    gutter = ws.cell(row=_TSHAPE_HEADER_ROW, column=_TSHAPE_GUTTER)
    gutter.border = Border()
    _write_tshape_header_row(ws, _TSHAPE_RIGHT_PARTICULARS, _TSHAPE_RIGHT_FIRST, headers, last_border=_THIN)
    ws.row_dimensions[_TSHAPE_HEADER_ROW].height = 28
    ws.column_dimensions[get_column_letter(_TSHAPE_LEFT_PARTICULARS)].width = 36
    ws.column_dimensions[get_column_letter(_TSHAPE_RIGHT_PARTICULARS)].width = 32
    ws.column_dimensions[get_column_letter(_TSHAPE_GUTTER)].width = 2
    for offset in range(4):
        ws.column_dimensions[get_column_letter(_TSHAPE_LEFT_FIRST + offset)].width = 22
        ws.column_dimensions[get_column_letter(_TSHAPE_RIGHT_FIRST + offset)].width = 22

    right_padded = list(TSHAPE_RIGHT_ROWS[:-1]) + [None] * (
        _TSHAPE_BODY_ROWS - len(TSHAPE_RIGHT_ROWS)
    ) + [TSHAPE_RIGHT_ROWS[-1]]

    for offset, left_label in enumerate(TSHAPE_LEFT_ROWS):
        row = _TSHAPE_FIRST_BODY_ROW + offset
        right_label = right_padded[offset]
        _write_tshape_line(
            ws,
            row,
            left_label,
            particulars_col=_TSHAPE_LEFT_PARTICULARS,
            first_amt_col=_TSHAPE_LEFT_FIRST,
            last_border=_T_DIVIDER,
            grid=grid,
            side_labels=TSHAPE_LEFT_ROWS,
        )
        _write_tshape_line(
            ws,
            row,
            right_label,
            particulars_col=_TSHAPE_RIGHT_PARTICULARS,
            first_amt_col=_TSHAPE_RIGHT_FIRST,
            last_border=_THIN,
            grid=grid,
            side_labels=TSHAPE_RIGHT_ROWS,
        )
        ws.row_dimensions[row].height = 20


def _write_tshape_header_row(
    ws: Worksheet,
    particulars_col: int,
    first_amt_col: int,
    headers: list[str],
    *,
    last_border,
) -> None:
    particulars = ws.cell(row=_TSHAPE_HEADER_ROW, column=particulars_col, value='Particulars')
    _style(particulars, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
    for offset, heading in enumerate(headers):
        border = last_border if offset == len(headers) - 1 else _THIN
        cell = ws.cell(row=_TSHAPE_HEADER_ROW, column=first_amt_col + offset, value=heading)
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = _CENTER
        cell.border = border


def _write_tshape_line(
    ws: Worksheet,
    row: int,
    label: str | None,
    *,
    particulars_col: int,
    first_amt_col: int,
    last_border,
    grid: Mapping[str, Mapping[str, Any]],
    side_labels: tuple[str, ...],
) -> None:
    is_total = label == 'Total'
    font = _TOTAL_FONT if is_total else _ACCOUNT_FONT
    fill = _TOTAL_FILL if is_total else PatternFill()
    label_cell = ws.cell(row=row, column=particulars_col, value=label)
    _style(label_cell, font=font, fill=fill, alignment=_LEFT)
    keys = [key for key, _name in TSHAPE_BRANCH_COLUMNS] + ['total']
    body_labels = side_labels[:-1]
    for offset, key in enumerate(keys):
        border = last_border if offset == len(keys) - 1 else _THIN
        column = grid.get(key) or {}
        value = _side_total(column, body_labels) if is_total else column.get(label) if label else None
        cell = ws.cell(row=row, column=first_amt_col + offset)
        cell.font = font
        cell.fill = fill
        cell.alignment = _CENTER
        cell.border = border
        if value is None or value == '':
            cell.value = None
        else:
            cell.value = value
            apply_indian_number_format(cell)


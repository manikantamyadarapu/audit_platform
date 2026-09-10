"""Trading Account Abstract sheet — grouped structure filled from Trading sources."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from app.engines.financials_engine.engine.abstract_values import build_abstract_row_measures
from app.utils.indian_number_format import apply_indian_number_format

ABSTRACT_SHEET_NAME = 'Abstract'
ABSTRACT_TITLE = 'Trading Account Abstract'

_QTY_SUBHEADER = 'Qty in Gms / Cts'
_AMT_SUBHEADER = 'Amount in Rs'

ABSTRACT_MEASURE_GROUPS: tuple[str, ...] = (
    'Opening Stock',
    'Purchases',
    'Receipts - Jubilee Hills',
    'Transfer (Receipts)',
    'Issues - Internal Stock Transfer',
    'Issues - Jubilee Hills',
    'Consumption (Issues)',
    'Making Charges',
    'Sales',
    'Closing Stock',
    'Gross Profit',
    'CY GP %',
)

# (kind, label) — spacers have no label. Measure cells stay empty.
ABSTRACT_BODY_ROWS: tuple[tuple[str, str | None], ...] = (
    ('spacer', None),
    ('account', 'Gold Account 24K'),
    ('account', 'Gold Account 22K'),
    ('account', 'Gold Account 18K'),
    ('account', 'Gold Account 14K'),
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
    ('section_heading', 'Particulars'),
    ('spacer', None),
    ('group_heading', 'DIAMONDS'),
    ('item', 'Diamonds - Beads'),
    ('item', 'Diamonds Rosecut diamonds'),
    ('item', 'Diamonds - Flat polki'),
    ('item', 'Uncut - diamonds'),
    ('item', 'Diamonds'),
    ('group_total', 'Total Diamonds'),
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
_TITLE_FILL = PatternFill('solid', fgColor='CCFBF1')
_HEADER_FILL = PatternFill('solid', fgColor='0F766E')
_SECTION_FILL = PatternFill('solid', fgColor='99F6E4')
_GROUP_FILL = PatternFill('solid', fgColor='115E59')
_TOTAL_FILL = PatternFill('solid', fgColor='FEF3C7')
_TITLE_FONT = Font(name='Calibri', size=12, bold=True, color='0F172A')
_HEADER_FONT = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
_SECTION_FONT = Font(name='Calibri', size=11, bold=True, color='0F172A')
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
ABSTRACT_AMT_ONLY_GROUPS: frozenset[str] = frozenset({'Gross Profit', 'CY GP %'})


def abstract_column_span(group: str) -> int:
    return 1 if group in ABSTRACT_AMT_ONLY_GROUPS else 2


_LAST_COL = 1 + sum(abstract_column_span(group) for group in ABSTRACT_MEASURE_GROUPS)


def write_abstract_sheet(
    ws: Worksheet,
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    opening_pivot: Sequence[Mapping[str, Any]] | None = None,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
) -> None:
    """Write the Abstract sheet: grouped Particulars filled from Trading sources."""
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
    title = ws.cell(row=_TITLE_ROW, column=_PARTICULARS_COL, value=ABSTRACT_TITLE)
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
    for group in ABSTRACT_MEASURE_GROUPS:
        span = abstract_column_span(group)
        amt_col = col + span - 1
        if span == 2:
            ws.merge_cells(
                start_row=_GROUP_ROW,
                start_column=col,
                end_row=_GROUP_ROW,
                end_column=amt_col,
            )
            group_cell = ws.cell(row=_GROUP_ROW, column=col, value=group)
            _style(group_cell, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            sibling = ws.cell(row=_GROUP_ROW, column=amt_col)
            _style(sibling, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            qty = ws.cell(row=_SUB_ROW, column=col, value=_QTY_SUBHEADER)
            _style(qty, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            amt = ws.cell(row=_SUB_ROW, column=amt_col, value=_AMT_SUBHEADER)
            _style(amt, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            ws.column_dimensions[get_column_letter(col)].width = 14
            ws.column_dimensions[get_column_letter(amt_col)].width = 16
        else:
            ws.merge_cells(
                start_row=_GROUP_ROW,
                start_column=col,
                end_row=_SUB_ROW,
                end_column=col,
            )
            group_cell = ws.cell(row=_GROUP_ROW, column=col, value=group)
            _style(group_cell, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            sub = ws.cell(row=_SUB_ROW, column=col)
            _style(sub, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
            ws.column_dimensions[get_column_letter(col)].width = 16
        col += span

    ws.row_dimensions[_GROUP_ROW].height = 24
    ws.row_dimensions[_SUB_ROW].height = 28

    by_label = build_abstract_row_measures(
        layout_by_category,
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_pivot,
        mr_pivots=mr_pivots,
        dc_pivots=dc_pivots,
    )
    for offset, (kind, label) in enumerate(ABSTRACT_BODY_ROWS):
        measures = by_label.get(label or '') if kind not in {'spacer', 'section_heading', 'group_heading'} else None
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
    for col in range(_PARTICULARS_COL + 1, _LAST_COL + 1):
        _style(ws.cell(row=row, column=col), font=font, fill=fill, alignment=_CENTER)
    if measures:
        col = 2
        for group in ABSTRACT_MEASURE_GROUPS:
            pair = measures.get(group) or {}
            span = abstract_column_span(group)
            if span == 2:
                _write_numeric(ws.cell(row=row, column=col), pair.get('qty'))
                _write_numeric(ws.cell(row=row, column=col + 1), pair.get('amt'))
            else:
                _write_numeric(ws.cell(row=row, column=col), pair.get('amt'))
            col += span
    ws.row_dimensions[row].height = height


def _write_numeric(cell, value: Any) -> None:
    if value is None or value == '':
        cell.value = None
        return
    cell.value = value
    apply_indian_number_format(cell)


def _row_style(kind: str):
    if kind == 'section_heading':
        return _SECTION_FONT, _SECTION_FILL, _LEFT, 22
    if kind == 'group_heading':
        return _GROUP_FONT, _GROUP_FILL, _LEFT, 20
    if kind == 'item':
        return _ITEM_FONT, PatternFill(), _ITEM_ALIGN, 18
    if kind in {'total', 'group_total'}:
        return _TOTAL_FONT, _TOTAL_FILL, _LEFT, 20
    return _ACCOUNT_FONT, PatternFill(), _LEFT, 18


def _style(cell, *, font, fill, alignment) -> None:
    cell.font = font
    cell.fill = fill
    cell.alignment = alignment
    cell.border = _THIN

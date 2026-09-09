"""Blank Trading T-account sheet (structure only — no values or formulas)."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.worksheet import Worksheet

from app.utils.indian_number_format import apply_indian_number_format

TRADING_SHEET_NAME = 'Trading'

# Column map: left T | gutter | right T
_LEFT_PARTICULARS = 1
_LEFT_QTY = 2
_LEFT_AMT = 3
_GUTTER = 4
_RIGHT_PARTICULARS = 5
_RIGHT_QTY = 6
_RIGHT_AMT = 7

_BLANK_ROWS_BETWEEN_ACCOUNTS = 3
_GROSS_PROFIT_LABEL = 'To Gross Profit'
_FROM_HEAD_OFFICE = 'To Transfer from Head Office'
_TO_HEAD_OFFICE = 'By Transfer to Head Office'
_QTY_EPS = 1e-12

TRADING_ACCOUNT_SOURCE_CATEGORY: dict[str, str] = {
    'DIAMONDS ACCOUNT': 'Diamond',
    'EMERALDS ACCOUNT': 'Emerald',
    'RUBIES ACCOUNT': 'Rubie',
    'PEARLS ACCOUNT': 'Pearls',
    'COLOR STONES ACCOUNT': 'Precious and Semi Precious',
}

_LINE_MEASURES: dict[str, tuple[str, str]] = {
    'To Opening Stock': ('openingQty', 'openingAmt'),
    'To Purchases': ('purchasesQty', 'purchasesAmt'),
    'By Sales': ('salesQty', 'salesAmt'),
    'By Closing stock': ('closingStockQty', 'closingStockAmt'),
}

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
_HEADER_FILL = PatternFill('solid', fgColor='0F766E')
_TITLE_FILL = PatternFill('solid', fgColor='CCFBF1')
_TOTAL_FILL = PatternFill('solid', fgColor='FEF3C7')
_TITLE_FONT = Font(name='Calibri', size=12, bold=True, color='0F172A')
_HEADER_FONT = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
_BODY_FONT = Font(name='Calibri', size=10, color='0F172A')
_TOTAL_FONT = Font(name='Calibri', size=10, bold=True, color='92400E')
_CENTER = Alignment(horizontal='center', vertical='center', wrap_text=True)
_LEFT = Alignment(horizontal='left', vertical='center', wrap_text=True)

TRADING_ACCOUNTS: tuple[dict[str, object], ...] = (
    {
        'title': 'DIAMONDS ACCOUNT',
        'qty_header': 'Qty (Cts)',
        'left': (
            'To Opening Stock',
            'To Purchases',
            'To Gross Profit',
            'Total',
        ),
        'right': (
            'By Sales',
            'By Closing stock',
            'Total',
        ),
    },
    {
        'title': 'EMERALDS ACCOUNT',
        'qty_header': 'Qty (Cts)',
        'left': (
            'To Opening Stock',
            'To Purchases',
            'To Gross Profit',
            'Total',
        ),
        'right': (
            'By Sales',
            'By Closing stock',
            'Total',
        ),
    },
    {
        'title': 'RUBIES ACCOUNT',
        'qty_header': 'Qty (Cts)',
        'left': (
            'To Opening Stock',
            'To Purchases',
            'To Gross Profit',
            'Total',
        ),
        'right': (
            'By Sales',
            'By Closing stock',
            'Total',
        ),
    },
    {
        'title': 'PEARLS ACCOUNT',
        'qty_header': 'Qty (Grms)',
        'left': (
            'To Opening Stock',
            'To Purchases',
            'To Gross Profit',
            'Total',
        ),
        'right': (
            'By Sales',
            'By Closing stock',
            'Total',
        ),
    },
    {
        'title': 'COLOR STONES ACCOUNT',
        'qty_header': 'Qty (Cts)',
        'left': (
            'To Opening Stock',
            'To Purchases',
            'To Gross Profit',
            'Total',
        ),
        'right': (
            'By Sales',
            'By Closing stock',
            'Total',
        ),
    },
)


def _grand_total_from_layout(layout_rows: Sequence[Mapping[str, Any]] | None) -> dict[str, Any]:
    for row in reversed(list(layout_rows or [])):
        if str(row.get('kind') or '') == 'grand_total':
            return dict(row)
    return {}


def _coerce_measure(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _head_office_transfer(grand_total: Mapping[str, Any] | None) -> dict[str, Any] | None:
    """Qty sign picks the side; Amount is always ABS(Receipts Amt − Issues Amt)."""
    totals = grand_total or {}
    qty = (_coerce_measure(totals.get('receiptsJubileeHillsQty')) or 0.0) - (
        _coerce_measure(totals.get('issuesBanjaraHillsQty')) or 0.0
    )
    if abs(qty) <= _QTY_EPS:
        return None

    receipts_amt = _coerce_measure(totals.get('receiptsJubileeHillsAmt')) or 0.0
    issues_amt = _coerce_measure(totals.get('issuesBanjaraHillsAmt')) or 0.0
    amt = abs(receipts_amt - issues_amt)

    if qty > 0:
        return {
            'side': 'left',
            'label': _FROM_HEAD_OFFICE,
            'qty': qty,
            'amt': amt,
        }
    return {
        'side': 'right',
        'label': _TO_HEAD_OFFICE,
        'qty': abs(qty),
        'amt': amt,
    }


def _resolved_lines(
    grand_total: Mapping[str, Any] | None,
) -> tuple[list[str], list[str], dict[str, Any] | None]:
    left = ['To Opening Stock', 'To Purchases']
    right = ['By Sales']
    transfer = _head_office_transfer(grand_total)
    if transfer and transfer['side'] == 'left':
        left.append(_FROM_HEAD_OFFICE)
    left.extend(['To Gross Profit', 'Total'])
    if transfer and transfer['side'] == 'right':
        right.append(_TO_HEAD_OFFICE)
    right.extend(['By Closing stock', 'Total'])
    return left, right, transfer


def _as_zero(value: Any) -> float:
    number = _coerce_measure(value)
    return 0.0 if number is None else number


def _account_computed(
    grand_total: Mapping[str, Any] | None,
    transfer: Mapping[str, Any] | None,
) -> dict[str, float]:
    totals = grand_total or {}
    opening_qty = _as_zero(totals.get('openingQty'))
    opening_amt = _as_zero(totals.get('openingAmt'))
    purchases_qty = _as_zero(totals.get('purchasesQty'))
    purchases_amt = _as_zero(totals.get('purchasesAmt'))
    sales_qty = _as_zero(totals.get('salesQty'))
    sales_amt = _as_zero(totals.get('salesAmt'))
    closing_qty = _as_zero(totals.get('closingStockQty'))
    closing_amt = _as_zero(totals.get('closingStockAmt'))

    from_ho_qty = 0.0
    from_ho_amt = 0.0
    to_ho_qty = 0.0
    to_ho_amt = 0.0
    if transfer and transfer.get('side') == 'left':
        from_ho_qty = _as_zero(transfer.get('qty'))
        from_ho_amt = _as_zero(transfer.get('amt'))
    elif transfer and transfer.get('side') == 'right':
        to_ho_qty = _as_zero(transfer.get('qty'))
        to_ho_amt = _as_zero(transfer.get('amt'))

    right_qty = sales_qty + to_ho_qty + closing_qty
    right_amt = sales_amt + to_ho_amt + closing_amt
    gp_amt = right_amt - (opening_amt + purchases_amt + from_ho_amt)
    return {
        'grossProfitAmt': gp_amt,
        'leftQty': opening_qty + purchases_qty + from_ho_qty,
        'leftAmt': opening_amt + purchases_amt + from_ho_amt + gp_amt,
        'rightQty': right_qty,
        'rightAmt': right_amt,
    }


def _line_values(
    label: str | None,
    grand_total: Mapping[str, Any],
    transfer: Mapping[str, Any] | None = None,
    computed: Mapping[str, float] | None = None,
    *,
    side: str = 'left',
) -> tuple[Any, Any]:
    if not label:
        return None, None
    if label == _GROSS_PROFIT_LABEL:
        return None, (computed or {}).get('grossProfitAmt')
    if label == 'Total':
        calc = computed or {}
        if side == 'right':
            return calc.get('rightQty'), calc.get('rightAmt')
        return calc.get('leftQty'), calc.get('leftAmt')
    if transfer and label == transfer.get('label'):
        return transfer.get('qty'), transfer.get('amt')
    keys = _LINE_MEASURES.get(label)
    if not keys:
        return None, None
    qty_key, amt_key = keys
    return grand_total.get(qty_key), grand_total.get(amt_key)


def _write_numeric(cell, value: Any) -> None:
    if value is None or value == '':
        cell.value = None
        return
    cell.value = value
    apply_indian_number_format(cell)


def _style_cell(cell, *, font, fill=None, alignment=_CENTER, border=_THIN) -> None:
    cell.font = font
    cell.alignment = alignment
    cell.border = border
    if fill is not None:
        cell.fill = fill


def _write_header_triplet(
    ws: Worksheet,
    row: int,
    *,
    particulars_col: int,
    qty_col: int,
    amt_col: int,
    qty_header: str,
    amount_border,
) -> None:
    particulars = ws.cell(row=row, column=particulars_col, value='Particulars')
    _style_cell(particulars, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
    qty = ws.cell(row=row, column=qty_col, value=qty_header)
    _style_cell(qty, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER)
    amount = ws.cell(row=row, column=amt_col, value='Amount')
    _style_cell(amount, font=_HEADER_FONT, fill=_HEADER_FILL, alignment=_CENTER, border=amount_border)


def _write_line(
    ws: Worksheet,
    row: int,
    label: str | None,
    *,
    particulars_col: int,
    qty_col: int,
    amt_col: int,
    amount_border,
    qty_value: Any = None,
    amt_value: Any = None,
) -> None:
    is_total = label == 'Total'
    is_gp = label == _GROSS_PROFIT_LABEL
    fill = _TOTAL_FILL if is_total else None
    font = _TOTAL_FONT if is_total else _BODY_FONT

    particulars = ws.cell(row=row, column=particulars_col, value=label)
    _style_cell(particulars, font=font, fill=fill, alignment=_LEFT, border=_THIN)

    qty = ws.cell(row=row, column=qty_col, value=None)
    if is_gp:
        qty.border = Border(
            left=Side(style='thin', color='94A3B8'),
            right=Side(style='thin', color='94A3B8'),
            top=Side(style='thin', color='94A3B8'),
            bottom=Side(style='thin', color='94A3B8'),
        )
        qty.alignment = _CENTER
        if fill is not None:
            qty.fill = fill
    else:
        _style_cell(qty, font=font, fill=fill, alignment=_CENTER)
        _write_numeric(qty, qty_value)

    amount = ws.cell(row=row, column=amt_col, value=None)
    _style_cell(amount, font=font, fill=fill, alignment=_CENTER, border=amount_border)
    _write_numeric(amount, amt_value)


def _write_t_account(
    ws: Worksheet,
    start_row: int,
    account: dict[str, object],
    grand_total: Mapping[str, Any] | None = None,
) -> int:
    title = str(account['title'])
    qty_header = str(account['qty_header'])
    totals = grand_total or {}
    left_lines, right_lines, transfer = _resolved_lines(totals)
    computed = _account_computed(totals, transfer)

    ws.merge_cells(
        start_row=start_row,
        start_column=_LEFT_PARTICULARS,
        end_row=start_row,
        end_column=_RIGHT_AMT,
    )
    title_cell = ws.cell(row=start_row, column=_LEFT_PARTICULARS, value=title)
    _style_cell(title_cell, font=_TITLE_FONT, fill=_TITLE_FILL, alignment=_CENTER)
    for col in range(_LEFT_PARTICULARS, _RIGHT_AMT + 1):
        cell = ws.cell(row=start_row, column=col)
        cell.fill = _TITLE_FILL
        cell.border = _THIN
    ws.row_dimensions[start_row].height = 22

    header_row = start_row + 1
    _write_header_triplet(
        ws,
        header_row,
        particulars_col=_LEFT_PARTICULARS,
        qty_col=_LEFT_QTY,
        amt_col=_LEFT_AMT,
        qty_header=qty_header,
        amount_border=_T_DIVIDER,
    )
    gutter = ws.cell(row=header_row, column=_GUTTER, value=None)
    gutter.border = Border()
    _write_header_triplet(
        ws,
        header_row,
        particulars_col=_RIGHT_PARTICULARS,
        qty_col=_RIGHT_QTY,
        amt_col=_RIGHT_AMT,
        qty_header=qty_header,
        amount_border=_THIN,
    )

    left_body = left_lines[:-1]
    right_body = right_lines[:-1]
    body_rows = max(len(left_body), len(right_body))
    first_line_row = header_row + 1

    for offset in range(body_rows):
        row = first_line_row + offset
        left_label = left_body[offset] if offset < len(left_body) else None
        right_label = right_body[offset] if offset < len(right_body) else None
        left_qty, left_amt = _line_values(
            left_label, totals, transfer, computed, side='left'
        )
        right_qty, right_amt = _line_values(
            right_label, totals, transfer, computed, side='right'
        )
        _write_line(
            ws,
            row,
            left_label,
            particulars_col=_LEFT_PARTICULARS,
            qty_col=_LEFT_QTY,
            amt_col=_LEFT_AMT,
            amount_border=_T_DIVIDER,
            qty_value=left_qty,
            amt_value=left_amt,
        )
        gutter = ws.cell(row=row, column=_GUTTER, value=None)
        gutter.border = Border()
        _write_line(
            ws,
            row,
            right_label,
            particulars_col=_RIGHT_PARTICULARS,
            qty_col=_RIGHT_QTY,
            amt_col=_RIGHT_AMT,
            amount_border=_THIN,
            qty_value=right_qty,
            amt_value=right_amt,
        )

    left_total_qty, left_total_amt = _line_values(
        'Total', totals, transfer, computed, side='left'
    )
    right_total_qty, right_total_amt = _line_values(
        'Total', totals, transfer, computed, side='right'
    )
    total_row = first_line_row + body_rows
    _write_line(
        ws,
        total_row,
        'Total',
        particulars_col=_LEFT_PARTICULARS,
        qty_col=_LEFT_QTY,
        amt_col=_LEFT_AMT,
        amount_border=_T_DIVIDER,
        qty_value=left_total_qty,
        amt_value=left_total_amt,
    )
    gutter = ws.cell(row=total_row, column=_GUTTER, value=None)
    gutter.border = Border()
    _write_line(
        ws,
        total_row,
        'Total',
        particulars_col=_RIGHT_PARTICULARS,
        qty_col=_RIGHT_QTY,
        amt_col=_RIGHT_AMT,
        amount_border=_THIN,
        qty_value=right_total_qty,
        amt_value=right_total_amt,
    )

    return total_row + 1 + _BLANK_ROWS_BETWEEN_ACCOUNTS


def write_trading_sheet(
    ws: Worksheet,
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
) -> None:
    """Write the five T-accounts. Opening/Purchases/Sales/Closing copy GRAND TOTAL values."""
    layouts = layout_by_category or {}
    ws.title = TRADING_SHEET_NAME
    ws.sheet_state = 'visible'
    ws.sheet_properties.tabColor = '0F766E'
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1

    ws.column_dimensions['A'].width = 32
    ws.column_dimensions['B'].width = 14
    ws.column_dimensions['C'].width = 16
    ws.column_dimensions['D'].width = 3
    ws.column_dimensions['E'].width = 32
    ws.column_dimensions['F'].width = 14
    ws.column_dimensions['G'].width = 16

    row = 1
    for account in TRADING_ACCOUNTS:
        category = TRADING_ACCOUNT_SOURCE_CATEGORY[str(account['title'])]
        grand_total = _grand_total_from_layout(layouts.get(category))
        row = _write_t_account(ws, row, account, grand_total)

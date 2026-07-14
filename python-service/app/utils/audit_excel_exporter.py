"""
Reusable multi-sheet audit Excel exporter.

Accepts a workbook title and a mapping of sheet name → rows, then produces a
styled .xlsx matching HAA Audit Platform export conventions (header fill,
freeze panes, autofilter, auto-width). Empty rule sheets still get created
with a placeholder message.
"""

from __future__ import annotations

from io import BytesIO
from typing import Any, Mapping, Sequence

import pandas as pd

EMPTY_SHEET_MESSAGE = 'No report for this audit rule.'

_HEADER_STYLE = {
    'bold': True,
    'font_color': 'white',
    'bg_color': '#1F4E78',
    'border': 1,
}

# Excel sheet-name limits / forbidden characters.
_EXCEL_SHEET_FORBIDDEN = set(r'\/?*[]')
_EXCEL_SHEET_MAX_LEN = 31


def sanitize_sheet_name(name: str, *, used: set[str] | None = None) -> str:
    """Return a valid, unique Excel worksheet name."""
    cleaned = ''.join('_' if ch in _EXCEL_SHEET_FORBIDDEN else ch for ch in str(name or 'Sheet'))
    cleaned = cleaned.strip() or 'Sheet'
    cleaned = cleaned[:_EXCEL_SHEET_MAX_LEN]

    if used is None:
        return cleaned

    candidate = cleaned
    suffix = 1
    while candidate in used:
        tail = f'_{suffix}'
        candidate = f'{cleaned[: _EXCEL_SHEET_MAX_LEN - len(tail)]}{tail}'
        suffix += 1
    used.add(candidate)
    return candidate


def _stringify_cell(value: Any) -> Any:
    if value is None:
        return ''
    if isinstance(value, float) and value != value:  # NaN
        return ''
    if isinstance(value, (list, tuple, set)):
        return '; '.join(str(item) for item in value if item not in (None, ''))
    return value


def _rows_to_dataframe(
    rows: Sequence[Mapping[str, Any]] | None,
    *,
    columns: Sequence[str] | None = None,
    header_map: Mapping[str, str] | None = None,
) -> pd.DataFrame:
    records = [dict(row) for row in (rows or [])]
    if not records:
        ordered = list(columns or [])
        if header_map:
            ordered = [header_map.get(col, col) for col in ordered]
        return pd.DataFrame(columns=ordered or ['Message'])

    frame = pd.DataFrame(records)
    if columns:
        for column in columns:
            if column not in frame.columns:
                frame[column] = ''
        frame = frame[list(columns)]
    else:
        # Drop internal / debug fields when caller did not pin columns.
        drop_cols = [
            col
            for col in frame.columns
            if str(col).startswith('__')
            or str(col) in {'issues', 'issueCode', 'severity', 'messages', 'source_excel_row_number'}
        ]
        if drop_cols:
            frame = frame.drop(columns=drop_cols, errors='ignore')

    for column in frame.columns:
        frame[column] = frame[column].map(_stringify_cell)

    if header_map:
        frame = frame.rename(columns={k: v for k, v in header_map.items() if k in frame.columns})
    return frame


def _max_value_length(series: pd.Series) -> int:
    if series.empty:
        return 0
    return max((len(str(value)) for value in series.fillna('').tolist()), default=0)


def _style_populated_sheet(workbook: Any, worksheet: Any, dataframe: pd.DataFrame) -> None:
    header_format = workbook.add_format(_HEADER_STYLE)
    worksheet.freeze_panes(1, 0)
    if len(dataframe.columns):
        worksheet.autofilter(0, 0, max(len(dataframe), 1), max(len(dataframe.columns) - 1, 0))
    for idx, column in enumerate(dataframe.columns):
        width = max(len(str(column)), _max_value_length(dataframe[column])) + 2
        worksheet.set_column(idx, idx, min(width, 60))
        worksheet.write(0, idx, column, header_format)


def _write_empty_sheet(workbook: Any, worksheet: Any, message: str = EMPTY_SHEET_MESSAGE) -> None:
    message_format = workbook.add_format({'italic': True, 'font_color': '#666666'})
    worksheet.write(0, 0, message, message_format)
    worksheet.set_column(0, 0, max(len(message) + 4, 40))


def build_multi_sheet_audit_workbook(
    sheets: Mapping[str, Sequence[Mapping[str, Any]] | None],
    *,
    columns: Sequence[str] | None = None,
    header_map: Mapping[str, str] | None = None,
    empty_message: str = EMPTY_SHEET_MESSAGE,
) -> bytes:
    """
    Build a multi-sheet audit workbook.

    Args:
        sheets: Ordered mapping of sheet display name → list of row dicts.
                Every key becomes a worksheet, even when the list is empty.
        columns: Optional internal column keys to keep / order.
        header_map: Optional rename map for display headers.
        empty_message: Placeholder text for sheets with zero rows.

    Returns:
        Excel file bytes (.xlsx).
    """
    if not sheets:
        raise ValueError('At least one worksheet definition is required')

    output = BytesIO()
    used_names: set[str] = set()

    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        workbook = writer.book
        for raw_name, rows in sheets.items():
            sheet_name = sanitize_sheet_name(raw_name, used=used_names)
            row_list = list(rows or [])

            if not row_list:
                # Create an empty sheet, then write the placeholder message.
                pd.DataFrame({' ': []}).to_excel(writer, index=False, header=False, sheet_name=sheet_name)
                worksheet = writer.sheets[sheet_name]
                # Clear the blank frame write and put the message.
                worksheet.write(0, 0, '')
                _write_empty_sheet(workbook, worksheet, empty_message)
                continue

            dataframe = _rows_to_dataframe(row_list, columns=columns, header_map=header_map)
            dataframe.to_excel(writer, index=False, sheet_name=sheet_name)
            _style_populated_sheet(workbook, writer.sheets[sheet_name], dataframe)

    output.seek(0)
    return output.getvalue()


def build_rule_sheet_workbook(
    rule_rows: Mapping[str, Sequence[Mapping[str, Any]] | None],
    *,
    columns: Sequence[str] | None = None,
    header_map: Mapping[str, str] | None = None,
    empty_message: str = EMPTY_SHEET_MESSAGE,
) -> bytes:
    """Alias for callers that group rows by audit-rule widget name."""
    return build_multi_sheet_audit_workbook(
        rule_rows,
        columns=columns,
        header_map=header_map,
        empty_message=empty_message,
    )

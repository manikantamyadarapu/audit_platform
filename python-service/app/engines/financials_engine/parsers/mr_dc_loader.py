"""Load Material Receipts (MR) / Delivery Challan (DC) workbooks by header name."""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd

from app.engines.financials_engine.config.constants import HEADER_SCAN_LIMIT
from app.engines.financials_engine.config.mr_dc_columns import (
    ALIAS_TO_LOGICAL,
    MR_DC_COLUMN_SPEC,
    MR_DC_REQUIRED_DISPLAY,
    MR_DC_REQUIRED_LOGICAL,
)
from app.engines.financials_engine.parsers.workbook_loader import (
    parse_numeric_value,
)
from app.utils.header_cleaner import normalize_header
from app.utils.sheet_validation_error import SheetValidationError


def _display_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).replace('\n', ' ').replace('\r', ' ').strip()


def _logical_keys_from_row(row: pd.Series) -> set[str]:
    found: set[str] = set()
    for cell in row.tolist():
        logical = ALIAS_TO_LOGICAL.get(normalize_header(cell))
        if logical:
            found.add(logical)
    return found


def _required_for_source(_source_label: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
    return MR_DC_REQUIRED_LOGICAL, MR_DC_REQUIRED_DISPLAY


def _missing_display(found: set[str], required_logical: tuple[str, ...]) -> list[str]:
    return [
        MR_DC_COLUMN_SPEC[logical][0]
        for logical in required_logical
        if logical not in found
    ]


def _find_header_row(
    raw: pd.DataFrame,
    *,
    required_logical: tuple[str, ...],
    required_display: tuple[str, ...],
) -> tuple[int | None, list[str]]:
    best_index: int | None = None
    best_missing: list[str] = list(required_display)
    scan = min(HEADER_SCAN_LIMIT, len(raw.index))
    required = set(required_logical)
    for idx in range(scan):
        found = _logical_keys_from_row(raw.iloc[idx])
        missing = _missing_display(found, required_logical)
        if not missing and found >= required:
            return int(idx), []
        if len(missing) < len(best_missing):
            best_index = int(idx)
            best_missing = missing
    return best_index, best_missing


def _raise_missing(
    *,
    source_label: str,
    file_name: str,
    missing: list[str],
    header_row: int | None,
    expected_columns: tuple[str, ...],
) -> None:
    if len(missing) == 1:
        missing_line = f'Missing required column: {missing[0]}'
    else:
        missing_line = f'Missing required columns: {", ".join(missing)}'
    raise SheetValidationError(
        f'Unable to process {source_label} file.\n{missing_line}',
        code='MISSING_COLUMNS',
        fileName=file_name,
        source=source_label,
        missingColumns=missing,
        expectedColumns=list(expected_columns),
        headerRowExcel=(header_row + 1) if header_row is not None else None,
    )


def _resolve_column_map(columns: list[str]) -> dict[str, str]:
    resolved: dict[str, str] = {}
    for col in columns:
        logical = ALIAS_TO_LOGICAL.get(normalize_header(col))
        if logical and logical not in resolved:
            resolved[logical] = col
    return resolved


def load_transfer_workbook(
    file_bytes: bytes,
    file_name: str,
    *,
    source_label: str,
) -> list[dict[str, Any]]:
    """
    Parse an MR or DC workbook.

    Columns are located by case-insensitive, whitespace-tolerant names.
    Column order does not matter.
    """
    raw = pd.read_excel(
        BytesIO(file_bytes),
        engine='openpyxl',
        header=None,
        nrows=max(HEADER_SCAN_LIMIT, 120),
    )
    required_logical, required_display = _required_for_source(source_label)
    header_row_index, missing = _find_header_row(
        raw,
        required_logical=required_logical,
        required_display=required_display,
    )
    if missing:
        _raise_missing(
            source_label=source_label,
            file_name=file_name,
            missing=missing,
            header_row=header_row_index,
            expected_columns=required_display,
        )
    assert header_row_index is not None

    dataframe = pd.read_excel(
        BytesIO(file_bytes),
        engine='openpyxl',
        header=int(header_row_index),
    )
    original_columns = [
        str(c) if c is not None and not (isinstance(c, float) and pd.isna(c)) else ''
        for c in dataframe.columns
    ]
    column_map = _resolve_column_map(original_columns)
    still_missing = _missing_display(set(column_map), required_logical)
    if still_missing:
        _raise_missing(
            source_label=source_label,
            file_name=file_name,
            missing=still_missing,
            header_row=header_row_index,
            expected_columns=required_display,
        )

    product_col = column_map['product']
    quantity_col = column_map['quantity']
    gross_col = column_map['gross_amount']
    branch_col = column_map['branch']
    party_col = column_map.get('party')

    rows: list[dict[str, Any]] = []
    for _, series in dataframe.iterrows():
        product = _display_text(series.get(product_col))
        if not product:
            continue
        rows.append(
            {
                'product': product,
                'quantity': parse_numeric_value(series.get(quantity_col)),
                'grossAmount': parse_numeric_value(series.get(gross_col)),
                'branch': _display_text(series.get(branch_col)),
                'party': _display_text(series.get(party_col)) if party_col else '',
            }
        )
    return rows

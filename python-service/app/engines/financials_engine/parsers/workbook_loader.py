"""Load Sales/Purchases workbooks by dynamic Product / Quantity / Gross Amount headers."""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd

from app.engines.financials_engine.config.constants import (
    HEADER_SCAN_LIMIT,
    REQUIRED_COLUMN_KEYS,
    REQUIRED_DISPLAY_COLUMNS,
)
from app.utils.header_cleaner import normalize_header
from app.utils.sheet_validation_error import SheetValidationError


def parse_numeric_value(value: Any) -> float | None:
    """
    Convert Quantity / Gross Amount to float.

    Blank/null/invalid values return ``None`` (not ``0.0``) so callers can
    distinguish missing measures from a true zero. Handles plain numbers and
    comma-grouped strings such as ``14,30,000.39`` or ``1,234.56``.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text or text.lower() in {'nan', 'none', 'null', '-'}:
        return None

    # Strip currency symbols / spaces, keep digits, decimal point, and leading minus.
    cleaned = (
        text.replace(',', '')
        .replace(' ', '')
        .replace('\u00a0', '')
        .replace('₹', '')
        .replace('Rs.', '')
        .replace('Rs', '')
        .replace('INR', '')
    )
    if cleaned.endswith('%'):
        cleaned = cleaned[:-1]
    if not cleaned or cleaned in {'.', '-', '-.'}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def _display_product_name(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).replace('\n', ' ').replace('\r', ' ').strip()


def _cell_label(cell: Any) -> str:
    return normalize_header(cell)


def _labels_from_row(row: pd.Series) -> set[str]:
    labels: set[str] = set()
    for cell in row.tolist():
        label = _cell_label(cell)
        if label:
            labels.add(label)
    return labels


def _missing_required(labels: set[str]) -> list[str]:
    return [
        display
        for key, display in REQUIRED_COLUMN_KEYS.items()
        if key not in labels
    ]


def _find_header_row(raw: pd.DataFrame) -> tuple[int | None, list[str]]:
    """
    Scan rows for the transaction header by required column *names*.

    Returns (header_row_index, missing_display_names).
    Prefer a full match; otherwise keep the closest candidate for error reporting.
    """
    best_index: int | None = None
    best_missing: list[str] = list(REQUIRED_DISPLAY_COLUMNS)
    scan = min(HEADER_SCAN_LIMIT, len(raw.index))

    for idx in range(scan):
        labels = _labels_from_row(raw.iloc[idx])
        missing = _missing_required(labels)
        if not missing:
            return int(idx), []
        if len(missing) < len(best_missing):
            best_index = int(idx)
            best_missing = missing

    return best_index, best_missing


def _raise_missing_columns(
    *,
    source_label: str,
    file_name: str,
    missing: list[str],
    header_row_index: int | None,
    found_labels: list[str] | None = None,
) -> None:
    if len(missing) == 1:
        missing_line = f'Missing required column: {missing[0]}'
    else:
        missing_line = f'Missing required columns: {", ".join(missing)}'

    detail = f'Unable to process {source_label} file.\n{missing_line}'
    context: dict[str, Any] = {
        'fileName': file_name,
        'source': source_label,
        'missingColumns': missing,
        'expectedColumns': list(REQUIRED_DISPLAY_COLUMNS),
    }
    if header_row_index is not None:
        context['headerRowExcel'] = header_row_index + 1
    if found_labels:
        context['foundColumns'] = found_labels

    raise SheetValidationError(detail, code='MISSING_COLUMNS', **context)


def _resolve_column_map(columns: list[str]) -> dict[str, str]:
    """
    Map required logical keys → actual dataframe column names by header name.

    Column order in the sheet does not matter. First exact normalized match wins.
    """
    resolved: dict[str, str] = {}
    for col in columns:
        key = normalize_header(col)
        if key in REQUIRED_COLUMN_KEYS and key not in resolved:
            resolved[key] = col
    return resolved


def load_financials_workbook(
    file_bytes: bytes,
    file_name: str,
    *,
    source_label: str,
) -> tuple[list[dict[str, Any]], int]:
    """
    Dynamically locate Product / Quantity / Gross Amount by header name, then
    return (detail rows, 0-based header_row_index).

    Does not assume header row 1, column order, or Excel column letters.
    Blank Product rows (e.g. Round Off Type / Round Off Account metadata) are skipped.
    """
    raw = pd.read_excel(
        BytesIO(file_bytes),
        engine='openpyxl',
        header=None,
        nrows=max(HEADER_SCAN_LIMIT, 120),
    )
    header_row_index, missing = _find_header_row(raw)
    if missing:
        found: list[str] = []
        if header_row_index is not None:
            found = sorted(_labels_from_row(raw.iloc[header_row_index]))
        _raise_missing_columns(
            source_label=source_label,
            file_name=file_name,
            missing=missing,
            header_row_index=header_row_index,
            found_labels=found or None,
        )

    assert header_row_index is not None

    # Re-read with the detected header row so all transaction rows below are loaded.
    dataframe = pd.read_excel(
        BytesIO(file_bytes),
        engine='openpyxl',
        header=int(header_row_index),
    )
    # Keep original display names for mapping, then locate by normalized name.
    original_columns = [str(c) if c is not None and not (isinstance(c, float) and pd.isna(c)) else '' for c in dataframe.columns]
    column_map = _resolve_column_map(original_columns)
    still_missing = [
        display
        for key, display in REQUIRED_COLUMN_KEYS.items()
        if key not in column_map
    ]
    if still_missing:
        _raise_missing_columns(
            source_label=source_label,
            file_name=file_name,
            missing=still_missing,
            header_row_index=header_row_index,
            found_labels=[normalize_header(c) for c in original_columns if normalize_header(c)],
        )

    product_col = column_map['product']
    quantity_col = column_map['quantity']
    gross_col = column_map['gross_amount']

    rows: list[dict[str, Any]] = []
    for _, series in dataframe.iterrows():
        product = _display_product_name(series.get(product_col))
        # Skip blank Product (Round Off Type / Round Off Account and similar non-product rows).
        if not product:
            continue
        rows.append(
            {
                'product': product,
                'quantity': parse_numeric_value(series.get(quantity_col)),
                'grossAmount': parse_numeric_value(series.get(gross_col)),
            }
        )

    return rows, header_row_index

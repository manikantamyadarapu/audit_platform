"""Load Material Receipts (MR) / Delivery Challan (DC) workbooks with classification hints."""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd

from app.engines.financials_engine.config.constants import (
    HEADER_SCAN_LIMIT,
    REQUIRED_COLUMN_KEYS,
    REQUIRED_DISPLAY_COLUMNS,
)
from app.engines.financials_engine.config.receipts_issues_config import (
    build_classification_matcher,
    load_receipts_issues_classification,
)
from app.engines.financials_engine.parsers.workbook_loader import (
    _display_product_name,
    _find_header_row,
    _labels_from_row,
    _raise_missing_columns,
    _resolve_column_map,
    parse_numeric_value,
)
from app.utils.header_cleaner import normalize_header


def _classification_column_names(
    original_columns: list[str],
    *,
    aliases: list[str],
) -> list[str]:
    """Return original column names whose normalized header matches a classification alias."""
    wanted = {a.replace(' ', '_') for a in aliases}
    found: list[str] = []
    seen: set[str] = set()
    for col in original_columns:
        key = normalize_header(col).replace(' ', '_')
        if key in wanted and col not in seen:
            seen.add(col)
            found.append(col)
    return found


def _row_classification_hint(series: pd.Series, columns: list[str]) -> str:
    parts: list[str] = []
    for col in columns:
        value = series.get(col)
        if value is None or (isinstance(value, float) and pd.isna(value)):
            continue
        text = str(value).replace('\n', ' ').replace('\r', ' ').strip()
        if text and text.lower() not in {'nan', 'none', 'null', '-'}:
            parts.append(text)
    return ' | '.join(parts)


def load_transfer_workbook(
    file_bytes: bytes,
    file_name: str,
    *,
    source_label: str,
    classification_aliases: list[str] | None = None,
) -> tuple[list[dict[str, Any]], int, dict[str, Any]]:
    """
    Load MR or DC Excel like Sales/Purchases (Product / Quantity / Gross Amount).

    Also captures optional classification columns (godown/party/branch/…) when present.
    Returns (rows, header_row_index, meta).
    """
    if classification_aliases is None:
        matcher = build_classification_matcher(load_receipts_issues_classification())
        classification_aliases = list(matcher.get('classificationColumnAliases') or [])

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
    class_cols = _classification_column_names(
        original_columns,
        aliases=classification_aliases,
    )

    rows: list[dict[str, Any]] = []
    for _, series in dataframe.iterrows():
        product = _display_product_name(series.get(product_col))
        if not product:
            continue
        rows.append(
            {
                'product': product,
                'quantity': parse_numeric_value(series.get(quantity_col)),
                'grossAmount': parse_numeric_value(series.get(gross_col)),
                'classificationHint': _row_classification_hint(series, class_cols),
            }
        )

    meta = {
        'headerRowIndex': header_row_index,
        'classificationColumns': class_cols,
        'requiredColumns': list(REQUIRED_DISPLAY_COLUMNS),
        'sourceLabel': source_label,
        'fileName': file_name,
        'rowCount': len(rows),
    }
    return rows, header_row_index, meta

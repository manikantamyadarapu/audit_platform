"""Load Sales/Purchases workbooks by dynamic Product / Quantity / Gross Amount headers."""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd

from app.engines.financials_engine.config.constants import (
    CATEGORY_HEADER_ALIASES,
    CREDIT_NOTE_COLUMN_KEYS,
    DEBIT_NOTE_COLUMN_KEYS,
    HEADER_SCAN_LIMIT,
    REQUIRED_COLUMN_KEYS,
    REQUIRED_DISPLAY_COLUMNS,
    SUBCATEGORY_HEADER_ALIASES,
)
from app.utils.header_cleaner import normalize_header
from app.utils.sheet_validation_error import SheetValidationError


def parse_numeric_value(value: Any) -> float:
    """
    Convert Quantity / Gross Amount to float.

    Handles blank/null, plain numbers, and comma-grouped strings such as
    ``14,30,000.39`` (Indian-style grouping) or ``1,234.56``.
    """
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    if isinstance(value, bool):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text or text.lower() in {'nan', 'none', 'null', '-'}:
        return 0.0

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
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


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


def _missing_required(
    labels: set[str],
    required: dict[str, str] | None = None,
) -> list[str]:
    keys = REQUIRED_COLUMN_KEYS if required is None else required
    return [
        display
        for key, display in keys.items()
        if key not in labels
    ]


def _find_header_row(
    raw: pd.DataFrame,
    required: dict[str, str] | None = None,
) -> tuple[int | None, list[str]]:
    """
    Scan rows for the transaction header by required column *names*.

    Returns (header_row_index, missing_display_names).
    Prefer a full match; otherwise keep the closest candidate for error reporting.
    """
    keys = REQUIRED_COLUMN_KEYS if required is None else required
    best_index: int | None = None
    best_missing: list[str] = list(keys.values())
    scan = min(HEADER_SCAN_LIMIT, len(raw.index))

    for idx in range(scan):
        labels = _labels_from_row(raw.iloc[idx])
        missing = _missing_required(labels, keys)
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
    expected_columns: tuple[str, ...] | list[str] | None = None,
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
        'expectedColumns': list(expected_columns or REQUIRED_DISPLAY_COLUMNS),
    }
    if header_row_index is not None:
        context['headerRowExcel'] = header_row_index + 1
    if found_labels:
        context['foundColumns'] = found_labels

    raise SheetValidationError(detail, code='MISSING_COLUMNS', **context)


def _resolve_optional_column(
    columns: list[str],
    aliases: frozenset[str],
    *,
    exclude: set[str] | None = None,
) -> str | None:
    skipped = exclude or set()
    for col in columns:
        if col in skipped:
            continue
        if normalize_header(col) in aliases:
            return col
    return None


def _resolve_column_map(
    columns: list[str],
    required: dict[str, str] | None = None,
) -> dict[str, str]:
    """
    Map required logical keys → actual dataframe column names by header name.

    Column order in the sheet does not matter. First exact normalized match wins.
    """
    keys = REQUIRED_COLUMN_KEYS if required is None else required
    resolved: dict[str, str] = {}
    for col in columns:
        key = normalize_header(col)
        if key in keys and key not in resolved:
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
    category_col = _resolve_optional_column(original_columns, CATEGORY_HEADER_ALIASES)
    subcategory_col = _resolve_optional_column(
        original_columns, SUBCATEGORY_HEADER_ALIASES, exclude={category_col or ''}
    )

    rows: list[dict[str, Any]] = []
    for _, series in dataframe.iterrows():
        product = _display_product_name(series.get(product_col))
        # Skip blank Product (Round Off Type / Round Off Account and similar non-product rows).
        if not product:
            continue
        row: dict[str, Any] = {
            'product': product,
            'quantity': parse_numeric_value(series.get(quantity_col)),
            'grossAmount': parse_numeric_value(series.get(gross_col)),
        }
        if category_col:
            category = _display_product_name(series.get(category_col))
            if category:
                row['category'] = category
        if subcategory_col:
            subcategory = _display_product_name(series.get(subcategory_col))
            if subcategory:
                row['subcategory'] = subcategory
        rows.append(row)

    return rows, header_row_index


def load_supplier_note_workbook(
    file_bytes: bytes,
    file_name: str,
    *,
    source_label: str,
    note_kind: str,
) -> tuple[list[dict[str, Any]], int]:
    """Load a supplier credit or debit note using Product and its amount column only.

    Credit notes require Product and Credit Amount. Debit notes require Product
    and Debit Amount. Quantity, Gross Amount, and every other column are ignored.
    The amount is returned as ``grossAmount`` with quantity 0 so it adjusts the
    purchase amount only.
    """
    if note_kind == 'credit':
        required = CREDIT_NOTE_COLUMN_KEYS
        amount_key = 'credit_amount'
    elif note_kind == 'debit':
        required = DEBIT_NOTE_COLUMN_KEYS
        amount_key = 'debit_amount'
    else:
        raise ValueError(f'Unsupported supplier note kind: {note_kind}')

    expected = tuple(required.values())
    raw = pd.read_excel(
        BytesIO(file_bytes),
        engine='openpyxl',
        header=None,
        nrows=max(HEADER_SCAN_LIMIT, 120),
    )
    header_row_index, missing = _find_header_row(raw, required)
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
            expected_columns=expected,
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
    column_map = _resolve_column_map(original_columns, required)
    still_missing = [display for key, display in required.items() if key not in column_map]
    if still_missing:
        _raise_missing_columns(
            source_label=source_label,
            file_name=file_name,
            missing=still_missing,
            header_row_index=header_row_index,
            found_labels=[normalize_header(c) for c in original_columns if normalize_header(c)],
            expected_columns=expected,
        )

    product_col = column_map['product']
    amount_col = column_map[amount_key]
    rows: list[dict[str, Any]] = []
    for _, series in dataframe.iterrows():
        product = _display_product_name(series.get(product_col))
        if not product:
            continue
        rows.append(
            {
                'product': product,
                'quantity': 0.0,
                'grossAmount': parse_numeric_value(series.get(amount_col)),
            }
        )
    return rows, header_row_index


_RETURN_SKIP_PRODUCTS = frozenset({'total', 'grand total', 'grandtotal', 'sub total', 'subtotal'})
_RETURN_SCAN_LIMIT = 200


def _return_header_missing(labels: set[str]) -> list[str]:
    missing: list[str] = []
    if 'product' not in labels and 'item_name' not in labels and 'stock_item' not in labels:
        missing.append('Product')
    if 'quantity' not in labels and 'qty' not in labels:
        missing.append('Quantity')
    if 'amount' not in labels and 'gross_amount' not in labels:
        missing.append('Amount')
    return missing


def _return_rows_from_dataframe(dataframe: pd.DataFrame) -> list[dict[str, Any]]:
    original_columns = [
        str(c) if c is not None and not (isinstance(c, float) and pd.isna(c)) else ''
        for c in dataframe.columns
    ]
    product_col = None
    item_col = None
    stock_item_col = None
    quantity_col = None
    qty_col = None
    amount_col = None
    gross_col = None
    for col in original_columns:
        key = normalize_header(col)
        if key == 'product' and product_col is None:
            product_col = col
        elif key == 'item_name' and item_col is None:
            item_col = col
        elif key == 'stock_item' and stock_item_col is None:
            stock_item_col = col
        elif key == 'quantity' and quantity_col is None:
            quantity_col = col
        elif key == 'qty' and qty_col is None:
            qty_col = col
        elif key == 'amount' and amount_col is None:
            amount_col = col
        elif key == 'gross_amount' and gross_col is None:
            gross_col = col
    chosen_product = product_col or item_col or stock_item_col
    chosen_quantity = quantity_col or qty_col
    chosen_amount = amount_col or gross_col
    if chosen_product is None or chosen_quantity is None or chosen_amount is None:
        return []

    rows: list[dict[str, Any]] = []
    for _, series in dataframe.iterrows():
        product = _display_product_name(series.get(chosen_product))
        if not product or product.casefold() in _RETURN_SKIP_PRODUCTS:
            continue
        rows.append(
            {
                'product': product,
                'quantity': parse_numeric_value(series.get(chosen_quantity)),
                'grossAmount': parse_numeric_value(series.get(chosen_amount)),
            }
        )
    return rows


def load_return_workbook(
    file_bytes: bytes,
    file_name: str,
    *,
    source_label: str,
) -> tuple[list[dict[str, Any]], int]:
    """Load Sales Return or Purchase Return using Product, Quantity, and Amount.

    Gross Amount is accepted as Amount when the file has no Amount column.
    Every other column is ignored. When a workbook has several sheets, the sheet
    with the product rows is used.
    """
    expected = ('Product', 'Quantity', 'Amount')
    book = pd.ExcelFile(BytesIO(file_bytes), engine='openpyxl')
    best_rows: list[dict[str, Any]] | None = None
    best_header: int | None = None
    closest_missing = list(expected)
    closest_header: int | None = None
    closest_labels: list[str] | None = None

    for sheet_name in book.sheet_names:
        raw = pd.read_excel(
            book,
            sheet_name=sheet_name,
            header=None,
            nrows=_RETURN_SCAN_LIMIT,
        )
        scan = min(_RETURN_SCAN_LIMIT, len(raw.index))
        for idx in range(scan):
            labels = _labels_from_row(raw.iloc[idx])
            row_missing = _return_header_missing(labels)
            if row_missing:
                if len(row_missing) < len(closest_missing):
                    closest_missing = row_missing
                    closest_header = int(idx)
                    closest_labels = sorted(labels)
                continue
            dataframe = pd.read_excel(
                book,
                sheet_name=sheet_name,
                header=int(idx),
            )
            rows = _return_rows_from_dataframe(dataframe)
            if best_rows is None or len(rows) > len(best_rows):
                best_rows = rows
                best_header = int(idx)

    if best_rows is None:
        _raise_missing_columns(
            source_label=source_label,
            file_name=file_name,
            missing=closest_missing,
            header_row_index=closest_header,
            found_labels=closest_labels,
            expected_columns=expected,
        )
    return best_rows, int(best_header or 0)

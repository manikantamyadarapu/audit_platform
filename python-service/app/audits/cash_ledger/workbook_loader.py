"""Detect and load Cash Ledger Excel workbooks with preamble rows above the header."""

from __future__ import annotations

from io import BytesIO
from time import perf_counter
from typing import Any

import pandas as pd
import polars as pl

from app.audits.cash_ledger.parser import (
    is_auditable_transaction_row,
    is_cash_ledger_footer_row,
    is_report_total_row,
)
from app.engines.vectorized_validation_engine import LoadedValidationSheet
from app.utils.excel_header_detection import find_header_row_index
from app.utils.header_cleaner import normalize_header
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError

CASH_LEDGER_HEADER_SCAN_LIMIT = 20

# Row must contain all of these normalized labels to qualify as the header.
CASH_LEDGER_HEADER_MARKER_COLUMNS = frozenset({
    'date',
    'voucher_no',
    'contra_account',
    'debit',
    'credit',
    'balance',
})


def cash_ledger_header_row_matches(labels: set[str]) -> bool:
    return CASH_LEDGER_HEADER_MARKER_COLUMNS.issubset(labels)


def _cell_display_text(cell: Any) -> str:
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return ''
    return str(cell).replace('\n', ' ').replace('\r', ' ').strip()


def _original_headers_from_row(row: pd.Series) -> list[str]:
    headers: list[str] = []
    for cell in row.tolist():
        text = _cell_display_text(cell)
        if text:
            headers.append(text)
    return headers


def _parse_header_row(row: pd.Series) -> tuple[list[str], list[int], dict[str, str]]:
    headers: list[str] = []
    positions: list[int] = []
    display_headers: dict[str, str] = {}
    seen: dict[str, int] = {}

    for idx, cell in enumerate(row.tolist()):
        label = normalize_header(cell)
        if not label:
            continue
        seen[label] = seen.get(label, 0) + 1
        unique_label = label if seen[label] == 1 else f'{label}_{seen[label]}'
        headers.append(unique_label)
        positions.append(idx)
        display_headers[unique_label] = _cell_display_text(cell) or unique_label

    return headers, positions, display_headers


def _log_detected_headers(
    log: Any,
    *,
    header_row_index: int,
    original_headers: list[str],
    normalized_headers: list[str],
) -> None:
    log.info(f'Detected Header Row: {header_row_index + 1}')
    log.info(f'Original Headers: {original_headers}')
    log.info(f'Normalized Headers: {normalized_headers}')


def load_cash_ledger_workbook(file_bytes: bytes, log: Any | None = None) -> LoadedValidationSheet:
    """
    Scan the first 20 rows, detect the real header, load data below it.
    """
    logger = log or get_logger()

    scan_start = perf_counter()
    header_row_index = find_header_row_index(
        file_bytes,
        cash_ledger_header_row_matches,
        scan_limit=CASH_LEDGER_HEADER_SCAN_LIMIT,
        preview_rows=CASH_LEDGER_HEADER_SCAN_LIMIT,
    )
    header_detection_ms = (perf_counter() - scan_start) * 1000

    if header_row_index is None:
        raise SheetValidationError(
            f'Could not detect Cash Ledger header row in the first {CASH_LEDGER_HEADER_SCAN_LIMIT} rows.',
            code='HEADER_NOT_FOUND',
            hints=[
                'The header row must include Date, Voucher No, Contra Account, Debit, Credit, and Balance.',
                'Title rows (company name, address, ledger remarks) above the header are supported.',
                'Example: row 5 may be the header while rows 1–4 are report metadata from Tally/ERP.',
            ],
        )

    load_start = perf_counter()
    raw_df = pd.read_excel(BytesIO(file_bytes), engine='openpyxl', header=None)
    header_row = raw_df.iloc[header_row_index]
    original_headers = _original_headers_from_row(header_row)
    headers, positions, column_display_headers = _parse_header_row(header_row)

    _log_detected_headers(
        logger,
        header_row_index=header_row_index,
        original_headers=original_headers,
        normalized_headers=headers,
    )

    columns: dict[str, list[Any]] = {header: [] for header in headers}
    source_excel_row_numbers: list[int] = []

    for excel_row_number, (_, row) in enumerate(
        raw_df.iloc[header_row_index + 1 :].iterrows(),
        start=header_row_index + 2,
    ):
        # 1) Drop completely blank rows.
        if _is_blank_data_row(row, positions):
            continue

        # 2 / 4) Footer begins → stop; ignore this row and every row after it.
        if is_cash_ledger_footer_row(row.tolist()):
            logger.info(
                f'Cash Ledger footer detected at Excel row {excel_row_number}; '
                'stopping transaction extraction.'
            )
            break

        row_values = _extract_row_values(headers, positions, row)

        # Also stop if footer text landed in a mapped column (e.g. Date).
        if is_cash_ledger_footer_row(row_values):
            logger.info(
                f'Cash Ledger footer detected at Excel row {excel_row_number}; '
                'stopping transaction extraction.'
            )
            break

        # 3) Ignore grand-total rows (debit/credit only).
        if is_report_total_row(row_values):
            continue

        if not is_auditable_transaction_row(row_values):
            continue

        for header in headers:
            columns[header].append(row_values[header])
        source_excel_row_numbers.append(excel_row_number)

    if headers and source_excel_row_numbers:
        excel_rows = pl.Series('source_excel_row_number', source_excel_row_numbers)
        dataframe = pl.DataFrame(columns, strict=False).with_columns(
            excel_rows.alias('source_excel_row_number'),
            excel_rows.alias('__excel_row_number__'),
        )
    elif headers:
        dataframe = pl.DataFrame(columns, strict=False).with_columns(
            pl.lit(None).cast(pl.Int64).alias('source_excel_row_number'),
            pl.lit(None).cast(pl.Int64).alias('__excel_row_number__'),
        )
    else:
        dataframe = pl.DataFrame(
            schema={
                'source_excel_row_number': pl.Int64,
                '__excel_row_number__': pl.Int64,
            }
        )

    load_ms = (perf_counter() - load_start) * 1000

    return LoadedValidationSheet(
        dataframe=dataframe,
        header_row_index=header_row_index,
        header_detection_ms=header_detection_ms,
        load_ms=load_ms,
        column_display_headers=column_display_headers,
    )


def _extract_row_values(headers: list[str], positions: list[int], row: pd.Series) -> dict[str, Any]:
    values: dict[str, Any] = {}
    for header, position in zip(headers, positions, strict=True):
        value = row.iloc[position] if position < len(row) else None
        if isinstance(value, float) and pd.isna(value):
            value = None
        values[header] = value
    return values


def _is_blank_data_row(row: pd.Series, positions: list[int]) -> bool:
    for position in positions:
        if position >= len(row):
            continue
        value = row.iloc[position]
        if value is None or (isinstance(value, float) and pd.isna(value)):
            continue
        if str(value).strip():
            return False
    return True

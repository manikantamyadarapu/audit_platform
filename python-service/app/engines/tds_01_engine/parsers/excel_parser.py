"""Parse Purchase Voucher Listing workbooks for TDS @ 0.1%."""

from __future__ import annotations

from io import BytesIO
from time import perf_counter
from typing import Any

import pandas as pd
import polars as pl

from app.core.vectorized_validation_engine import LoadedValidationSheet
from app.engines.cash_ledger_engine.parsers.parser import (
    is_cash_ledger_footer_row,
    is_empty_field,
    parse_amount,
)
from app.engines.tds_01_engine.config.constants import (
    HEADER_ALIASES,
    REQUIRED_COLUMNS,
)
from app.utils.excel_header_detection import find_header_row_index
from app.utils.header_cleaner import normalize_header
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError

HEADER_SCAN_LIMIT = 40

HEADER_MARKER_COLUMNS = frozenset({'date', 'party', 'gross_amount'})


def voucher_listing_header_row_matches(labels: set[str]) -> bool:
    """True when the row looks like a Purchase Voucher Listing header."""
    canonical = {HEADER_ALIASES.get(label, label) for label in labels}
    return HEADER_MARKER_COLUMNS.issubset(canonical) and (
        'voucher_no' in canonical
        or 'voucher_number' in canonical
        or 'voucher' in canonical
        or 'vch_no' in canonical
    )


def _cell_display_text(cell: Any) -> str:
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return ''
    return str(cell).replace('\n', ' ').replace('\r', ' ').strip()


def _parse_header_row(row: pd.Series) -> tuple[list[str], list[int], dict[str, str]]:
    headers: list[str] = []
    positions: list[int] = []
    display_headers: dict[str, str] = {}
    seen: dict[str, int] = {}

    for idx, cell in enumerate(row.tolist()):
        raw_label = normalize_header(cell)
        if not raw_label:
            continue
        label = HEADER_ALIASES.get(raw_label, raw_label)
        seen[label] = seen.get(label, 0) + 1
        unique_label = label if seen[label] == 1 else f'{label}_{seen[label]}'
        headers.append(unique_label)
        positions.append(idx)
        display_headers[unique_label] = _cell_display_text(cell) or unique_label

    return headers, positions, display_headers


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


def is_voucher_total_row(row: dict[str, Any]) -> bool:
    """Grand-total rows have amount but no party / voucher identity."""
    party_empty = is_empty_field(row.get('party'))
    voucher_empty = is_empty_field(row.get('voucher_no'))
    if not (party_empty and voucher_empty):
        return False
    return parse_amount(row.get('gross_amount')) is not None


def is_auditable_voucher_row(row: dict[str, Any]) -> bool:
    if is_voucher_total_row(row):
        return False
    if is_cash_ledger_footer_row(row):
        return False
    if is_empty_field(row.get('party')):
        return False
    return parse_amount(row.get('gross_amount')) is not None


def validate_required_columns(data_columns: set[str]) -> tuple[bool, list[str]]:
    missing = sorted(REQUIRED_COLUMNS - set(data_columns))
    return (len(missing) == 0, missing)


def load_purchase_voucher_workbook(
    file_bytes: bytes,
    log: Any | None = None,
) -> LoadedValidationSheet:
    """Detect header and load Purchase Voucher Listing rows."""
    logger = log or get_logger()

    scan_start = perf_counter()
    header_row_index = find_header_row_index(
        file_bytes,
        voucher_listing_header_row_matches,
        scan_limit=HEADER_SCAN_LIMIT,
        preview_rows=HEADER_SCAN_LIMIT,
    )
    header_detection_ms = (perf_counter() - scan_start) * 1000

    if header_row_index is None:
        raise SheetValidationError(
            f'Could not detect Purchase Voucher Listing header in the first '
            f'{HEADER_SCAN_LIMIT} rows.',
            code='HEADER_NOT_FOUND',
            hints=[
                'The header row must include Date, Voucher No, Party, and Gross Amount.',
                'Title / company rows above the header are supported.',
            ],
        )

    load_start = perf_counter()
    raw_df = pd.read_excel(BytesIO(file_bytes), engine='openpyxl', header=None)
    header_row = raw_df.iloc[header_row_index]
    headers, positions, column_display_headers = _parse_header_row(header_row)

    logger.info(f'Detected Header Row: {header_row_index + 1}')
    logger.info(f'Normalized Headers: {headers}')

    columns: dict[str, list[Any]] = {header: [] for header in headers}
    source_excel_row_numbers: list[int] = []
    original_order: list[int] = []
    order_counter = 0

    for excel_row_number, (_, row) in enumerate(
        raw_df.iloc[header_row_index + 1 :].iterrows(),
        start=header_row_index + 2,
    ):
        if _is_blank_data_row(row, positions):
            continue

        if is_cash_ledger_footer_row(row.tolist()):
            logger.info(
                f'Footer detected at Excel row {excel_row_number}; stopping extraction.'
            )
            break

        row_values = _extract_row_values(headers, positions, row)
        if is_cash_ledger_footer_row(row_values):
            logger.info(
                f'Footer detected at Excel row {excel_row_number}; stopping extraction.'
            )
            break

        if is_voucher_total_row(row_values):
            continue
        if not is_auditable_voucher_row(row_values):
            continue

        for header in headers:
            columns[header].append(row_values[header])
        source_excel_row_numbers.append(excel_row_number)
        original_order.append(order_counter)
        order_counter += 1

    if headers and source_excel_row_numbers:
        dataframe = pl.DataFrame(columns, strict=False).with_columns(
            pl.Series('source_excel_row_number', source_excel_row_numbers),
            pl.Series('__excel_row_number__', source_excel_row_numbers),
            pl.Series('__original_order', original_order),
        )
    elif headers:
        dataframe = pl.DataFrame(columns, strict=False).with_columns(
            pl.lit(None).cast(pl.Int64).alias('source_excel_row_number'),
            pl.lit(None).cast(pl.Int64).alias('__excel_row_number__'),
            pl.lit(None).cast(pl.Int64).alias('__original_order'),
        )
    else:
        dataframe = pl.DataFrame(
            schema={
                'source_excel_row_number': pl.Int64,
                '__excel_row_number__': pl.Int64,
                '__original_order': pl.Int64,
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

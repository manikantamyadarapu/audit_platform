"""Load Form 269 ledger workbooks (.xls and .xlsx) with case-insensitive header detection."""

from __future__ import annotations

from io import BytesIO
from time import perf_counter
from typing import Any

import pandas as pd
import polars as pl

from app.core.vectorized_validation_engine import LoadedValidationSheet
from app.engines.cash_ledger_engine.parsers.parser import (
    is_auditable_transaction_row,
    is_cash_ledger_footer_row,
    is_report_total_row,
)
from app.engines.cash_ledger_engine.parsers.workbook_loader import (
    CASH_LEDGER_HEADER_SCAN_LIMIT,
    _extract_row_values,
    _is_blank_data_row,
    _log_detected_headers,
    _original_headers_from_row,
    _parse_header_row,
    cash_ledger_header_row_matches,
)
from app.utils.excel_engine import resolve_pandas_excel_engine
from app.utils.excel_header_detection import find_header_row_index
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError


def load_form269_workbook(
    file_bytes: bytes,
    file_name: str,
    log: Any | None = None,
) -> LoadedValidationSheet:
    """
    Scan preamble rows, detect the ledger header, and load transaction rows.

    Supports legacy ``.xls`` (xlrd) and modern ``.xlsx`` / ``.xlsm`` (openpyxl).
    Required columns are matched case-insensitively via ``normalize_header``.
    """
    logger = log or get_logger()
    engine = resolve_pandas_excel_engine(file_name=file_name, file_bytes=file_bytes)

    scan_start = perf_counter()
    header_row_index = find_header_row_index(
        file_bytes,
        cash_ledger_header_row_matches,
        scan_limit=CASH_LEDGER_HEADER_SCAN_LIMIT,
        preview_rows=CASH_LEDGER_HEADER_SCAN_LIMIT,
        file_name=file_name,
        engine=engine,
    )
    header_detection_ms = (perf_counter() - scan_start) * 1000

    if header_row_index is None:
        raise SheetValidationError(
            f'Could not detect ledger header row in the first {CASH_LEDGER_HEADER_SCAN_LIMIT} rows.',
            code='HEADER_NOT_FOUND',
            hints=[
                'The header row must include Date, Voucher No, Contra Account, Debit, Credit, and Balance.',
                'Column names are matched case-insensitively (e.g. DEBIT and debit are equivalent).',
                'Title rows above the header are supported.',
            ],
        )

    load_start = perf_counter()
    raw_df = pd.read_excel(BytesIO(file_bytes), engine=engine, header=None)
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
        if _is_blank_data_row(row, positions):
            continue

        if is_cash_ledger_footer_row(row.tolist()):
            logger.info(
                f'Form 269 footer detected at Excel row {excel_row_number}; '
                'stopping transaction extraction.'
            )
            break

        row_values = _extract_row_values(headers, positions, row)

        if is_cash_ledger_footer_row(row_values):
            logger.info(
                f'Form 269 footer detected at Excel row {excel_row_number}; '
                'stopping transaction extraction.'
            )
            break

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

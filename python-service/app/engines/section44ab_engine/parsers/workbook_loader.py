"""Multi-file Excel loader for Section 44AB with account name detection."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from time import perf_counter
from typing import Any

import pandas as pd
import polars as pl

from app.engines.section44ab_engine.config.constants import (
    ACCOUNT_NAME_PATTERNS,
    DEFAULT_CASH_ACCOUNT,
    HEADER_SCAN_LIMIT,
    OPENING_BALANCE_PATTERNS,
    REQUIRED_COLUMNS,
    SECTION44AB_HEADER_MARKER_COLUMNS,
)
from app.utils.excel_header_detection import find_header_row_index
from app.utils.header_cleaner import normalize_header
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError


@dataclass
class FileProcessingResult:
    """Result of processing a single Excel file."""
    file_name: str
    account_name: str
    header_row_index: int
    total_data_rows: int
    opening_balance_rows_excluded: int
    debit_total: float
    credit_total: float
    processing_status: str
    validation_errors: list[str]


@dataclass
class Section44ABLoadedData:
    """Aggregated data from all processed files."""
    cash_results: list[FileProcessingResult]
    bank_results: list[FileProcessingResult]
    header_detection_ms: float
    load_ms: float


def _cell_display_text(cell: Any) -> str:
    """Extract display text from a cell, handling None and NaN."""
    if cell is None or (isinstance(cell, float) and pd.isna(cell)):
        return ''
    return str(cell).replace('\n', ' ').replace('\r', ' ').strip()


def _is_opening_balance_row(contra_account: str | None) -> bool:
    """Check if a row represents an opening balance."""
    if not contra_account:
        return False
    normalized = normalize_header(contra_account)
    return normalized in OPENING_BALANCE_PATTERNS


def _extract_account_name_from_header(raw_df: pd.DataFrame, header_row_index: int) -> str | None:
    """
    Extract account name from the header section (rows above the detected header).
    Look for patterns like "Account: American Express Corp - Credit cards account"
    """
    # Check rows above the header for account name
    for row_idx in range(max(0, header_row_index - 5), header_row_index):
        row = raw_df.iloc[row_idx]
        for cell in row:
            text = _cell_display_text(cell)
            if not text:
                continue
            text_lower = text.lower()
            for pattern in ACCOUNT_NAME_PATTERNS:
                idx = text_lower.find(pattern)
                if idx < 0:
                    continue
                account_name = text[idx + len(pattern) :].strip(' :-')
                if account_name:
                    return account_name
    return None


def _parse_header_row(row: pd.Series) -> tuple[list[str], list[int], dict[str, str]]:
    """Parse header row and return normalized headers, positions, and display headers."""
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


def _extract_row_values(headers: list[str], positions: list[int], row: pd.Series) -> dict[str, Any]:
    """Extract row values for the given headers and positions."""
    values: dict[str, Any] = {}
    for header, position in zip(headers, positions, strict=True):
        value = row.iloc[position] if position < len(row) else None
        if isinstance(value, float) and pd.isna(value):
            value = None
        values[header] = value
    return values


def _is_blank_data_row(row: pd.Series, positions: list[int]) -> bool:
    """Check if a data row is blank."""
    for position in positions:
        if position >= len(row):
            continue
        value = row.iloc[position]
        if value is None or (isinstance(value, float) and pd.isna(value)):
            continue
        if str(value).strip():
            return False
    return True


def _parse_numeric_value(value: Any) -> float:
    """Parse a numeric value from Excel, handling formatted strings."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        # Remove commas and other formatting
        cleaned = value.replace(',', '').replace(' ', '').strip()
        if cleaned:
            try:
                return float(cleaned)
            except ValueError:
                return 0.0
    return 0.0


def section44ab_header_row_matches(labels: set[str]) -> bool:
    """Check if a row contains all required header markers."""
    return SECTION44AB_HEADER_MARKER_COLUMNS.issubset(labels)


def load_section44ab_workbook(
    file_bytes: bytes,
    file_name: str,
    is_cash: bool,
    log: Any | None = None,
) -> FileProcessingResult:
    """
    Load a single Section 44AB workbook and extract totals.
    
    Args:
        file_bytes: Excel file as bytes
        file_name: Name of the file
        is_cash: True if this is a Cash file, False if Bank file
        log: Logger instance
    
    Returns:
        FileProcessingResult with extracted totals and metadata
    """
    logger = log or get_logger()
    
    scan_start = perf_counter()
    header_row_index = find_header_row_index(
        file_bytes,
        section44ab_header_row_matches,
        scan_limit=HEADER_SCAN_LIMIT,
        preview_rows=HEADER_SCAN_LIMIT,
    )
    header_detection_ms = (perf_counter() - scan_start) * 1000

    if header_row_index is None:
        return FileProcessingResult(
            file_name=file_name,
            account_name='',
            header_row_index=-1,
            total_data_rows=0,
            opening_balance_rows_excluded=0,
            debit_total=0.0,
            credit_total=0.0,
            processing_status='failed',
            validation_errors=['Could not detect header row in the first 20 rows'],
        )

    load_start = perf_counter()
    raw_df = pd.read_excel(BytesIO(file_bytes), engine='openpyxl', header=None)
    
    # Extract account name from header section
    account_name = _extract_account_name_from_header(raw_df, header_row_index)
    if not account_name:
        account_name = DEFAULT_CASH_ACCOUNT if is_cash else file_name
    
    header_row = raw_df.iloc[header_row_index]
    headers, positions, _ = _parse_header_row(header_row)
    
    logger.info(f'Section 44AB [{file_name}]: Header row {header_row_index + 1}, Account: {account_name}')
    logger.info(f'Section 44AB [{file_name}]: Normalized headers: {headers}')

    # Validate required columns
    header_set = set(headers)
    missing = REQUIRED_COLUMNS - header_set
    if missing:
        return FileProcessingResult(
            file_name=file_name,
            account_name=account_name,
            header_row_index=header_row_index,
            total_data_rows=0,
            opening_balance_rows_excluded=0,
            debit_total=0.0,
            credit_total=0.0,
            processing_status='failed',
            validation_errors=[f'Missing required columns: {", ".join(sorted(missing))}'],
        )

    # Get column indices
    try:
        contra_idx = headers.index('contra_account')
        debit_idx = headers.index('debit')
        credit_idx = headers.index('credit')
    except ValueError as e:
        return FileProcessingResult(
            file_name=file_name,
            account_name=account_name,
            header_row_index=header_row_index,
            total_data_rows=0,
            opening_balance_rows_excluded=0,
            debit_total=0.0,
            credit_total=0.0,
            processing_status='failed',
            validation_errors=[f'Column index error: {str(e)}'],
        )

    # Process data rows
    debit_total = 0.0
    credit_total = 0.0
    total_data_rows = 0
    opening_balance_excluded = 0
    validation_errors: list[str] = []

    for excel_row_number, (_, row) in enumerate(
        raw_df.iloc[header_row_index + 1 :].iterrows(),
        start=header_row_index + 2,
    ):
        # Skip blank rows
        if _is_blank_data_row(row, positions):
            continue
        
        # Extract row values
        row_values = _extract_row_values(headers, positions, row)
        contra_account = row_values.get('contra_account')
        
        # Check for opening balance
        if _is_opening_balance_row(contra_account):
            opening_balance_excluded += 1
            continue
        
        # Parse Debit and Credit
        debit_value = _parse_numeric_value(row_values.get('debit'))
        credit_value = _parse_numeric_value(row_values.get('credit'))
        
        debit_total += debit_value
        credit_total += credit_value
        total_data_rows += 1

    load_ms = (perf_counter() - load_start) * 1000

    logger.info(
        f'Section 44AB [{file_name}]: Processed {total_data_rows} rows, '
        f'excluded {opening_balance_excluded} opening balance rows, '
        f'Debit: {debit_total:.2f}, Credit: {credit_total:.2f}'
    )

    return FileProcessingResult(
        file_name=file_name,
        account_name=account_name,
        header_row_index=header_row_index,
        total_data_rows=total_data_rows,
        opening_balance_rows_excluded=opening_balance_excluded,
        debit_total=debit_total,
        credit_total=credit_total,
        processing_status='success',
        validation_errors=validation_errors,
    )


def load_section44ab_files(
    cash_files: list[tuple[str, bytes]],
    bank_files: list[tuple[str, bytes]],
    log: Any | None = None,
) -> Section44ABLoadedData:
    """
    Load multiple Cash and Bank files for Section 44AB.
    
    Args:
        cash_files: List of (file_name, file_bytes) tuples for Cash files
        bank_files: List of (file_name, file_bytes) tuples for Bank files
        log: Logger instance
    
    Returns:
        Section44ABLoadedData with aggregated results
    """
    logger = log or get_logger()
    
    start_time = perf_counter()
    
    cash_results: list[FileProcessingResult] = []
    bank_results: list[FileProcessingResult] = []
    
    # Process Cash files
    for file_name, file_bytes in cash_files:
        result = load_section44ab_workbook(file_bytes, file_name, is_cash=True, log=logger)
        cash_results.append(result)
    
    # Process Bank files
    for file_name, file_bytes in bank_files:
        result = load_section44ab_workbook(file_bytes, file_name, is_cash=False, log=logger)
        bank_results.append(result)
    
    total_ms = (perf_counter() - start_time) * 1000
    
    logger.info(
        f'Section 44AB: Loaded {len(cash_results)} Cash files, '
        f'{len(bank_results)} Bank files in {total_ms:.2f}ms'
    )
    
    return Section44ABLoadedData(
        cash_results=cash_results,
        bank_results=bank_results,
        header_detection_ms=0.0,  # Already included in individual file processing
        load_ms=total_ms,
    )

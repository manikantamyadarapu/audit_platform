"""Find the sheet row where real headers live (titles often precede labels)."""

from collections.abc import Callable
from io import BytesIO

import pandas as pd

from app.utils.excel_engine import resolve_pandas_excel_engine
from app.utils.header_cleaner import normalize_header


def header_labels_from_row(row: pd.Series) -> set[str]:
    """Non-empty normalized header tokens for one raw sheet row."""
    out: set[str] = set()
    for cell in row.tolist():
        label = normalize_header(cell)
        if label:
            out.add(label)
    return out


def find_header_row_index(
    file_bytes: bytes,
    row_matches: Callable[[set[str]], bool],
    *,
    scan_limit: int = 60,
    preview_rows: int = 80,
    file_name: str | None = None,
    engine: str | None = None,
) -> int | None:
    """
    Scan raw rows (no header=) until `row_matches` returns True for normalized labels in that row.
    Scan is 0-based: index 2 is Excel row 3 (header row).
    """
    read_engine = engine or resolve_pandas_excel_engine(
        file_name=file_name,
        file_bytes=file_bytes,
    )
    dataframe = pd.read_excel(
        BytesIO(file_bytes),
        engine=read_engine,
        header=None,
        nrows=max(preview_rows, scan_limit),
    )

    scan = min(scan_limit, len(dataframe.index))
    for idx in range(scan):
        headers = header_labels_from_row(dataframe.iloc[idx])
        if row_matches(headers):
            return int(idx)

    return None


def load_excel_with_header_row(
    file_bytes: bytes,
    header_row_index: int,
    *,
    file_name: str | None = None,
    engine: str | None = None,
) -> pd.DataFrame:
    read_engine = engine or resolve_pandas_excel_engine(
        file_name=file_name,
        file_bytes=file_bytes,
    )
    dataframe = pd.read_excel(
        BytesIO(file_bytes),
        engine=read_engine,
        header=int(header_row_index),
    )
    dataframe.columns = [normalize_header(c) for c in dataframe.columns]
    return dataframe

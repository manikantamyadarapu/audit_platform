from io import BytesIO
from typing import Any

import pandas as pd

from app.config.settings import get_settings
from app.utils.header_cleaner import normalize_headers


def tuple_cell_1(row: tuple[Any, ...] | list[Any] | None, col_1based: int) -> Any:
    """1-based column index into an openpyxl ``values_only`` row tuple (column A = 1)."""
    if not row:
        return None
    i = col_1based - 1
    if i < 0 or i >= len(row):
        return None
    return row[i]


def effective_excel_max_row(ws_max_row: int, cap: int) -> tuple[int, bool]:
    """
    Returns (effective_last_row_to_scan, truncated).

    ``cap`` 0 or negative means unlimited (use full ``ws_max_row``).
    """
    mr = max(ws_max_row, 0)
    if cap <= 0:
        return mr, False
    eff = min(mr, cap)
    return eff, mr > cap


class ExcelReader:
    def __init__(self) -> None:
        self.settings = get_settings()

    def read_excel(self, file_bytes: bytes) -> pd.DataFrame:
        dataframe = pd.read_excel(BytesIO(file_bytes), engine='openpyxl')
        dataframe.columns = normalize_headers(dataframe.columns)
        return dataframe

    def iter_chunks(self, dataframe: pd.DataFrame):
        chunk_size = max(1, self.settings.chunk_size)
        total_rows = len(dataframe)

        for start in range(0, total_rows, chunk_size):
            end = min(start + chunk_size, total_rows)
            yield start, dataframe.iloc[start:end]

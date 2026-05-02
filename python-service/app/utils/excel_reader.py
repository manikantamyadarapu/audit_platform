from io import BytesIO

import pandas as pd

from app.config.settings import get_settings
from app.utils.header_cleaner import normalize_headers


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

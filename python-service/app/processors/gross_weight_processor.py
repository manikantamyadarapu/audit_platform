from typing import Any

import pandas as pd

from app.config.settings import get_settings
from app.processors.base import BaseProcessor
from app.utils.excel_header_detection import find_header_row_index, load_excel_with_header_row
from app.utils.excel_reader import ExcelReader
from app.utils.response_builder import build_processing_response


def _gross_header_row_ok(labels: set[str]) -> bool:
    mg = 'manual_gross_weight' in labels or 'manual_gross_wt' in labels
    ag = 'auto_gross_weight' in labels or 'auto_gross_wt' in labels
    return mg and ag


class GrossWeightProcessor(BaseProcessor):
    REQUIRED_COLUMNS = {'manual_gross_weight', 'auto_gross_weight'}

    def __init__(self) -> None:
        self.reader = ExcelReader()
        self._settings = get_settings()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        header_idx = find_header_row_index(file_bytes, _gross_header_row_ok)
        if header_idx is not None:
            df = load_excel_with_header_row(file_bytes, header_idx)
        else:
            df = self.reader.read_excel(file_bytes)

        df = self._canonical_weight_columns(df)
        missing = self.REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise KeyError(f"Missing required columns: {', '.join(sorted(missing))}")

        tol = float(self._settings.gross_weight_tolerance)

        mismatches = 0
        for _, row in df.iterrows():
            man = row.get('manual_gross_weight')
            auto = row.get('auto_gross_weight')
            if pd.isna(man) or pd.isna(auto):
                continue
            try:
                m_f = float(man)
                a_f = float(auto)
            except (TypeError, ValueError):
                continue
            if abs(m_f - a_f) > tol:
                mismatches += 1

        total = len(df)
        return build_processing_response(
            file_type='gross_weight',
            total_rows=total,
            error_rows=mismatches,
            summary={
                'weightMismatch': mismatches,
            },
            records=[],
        )

    def _canonical_weight_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        renames = {}
        if 'manual_gross_wt' in df.columns:
            renames['manual_gross_wt'] = 'manual_gross_weight'
        if 'auto_gross_wt' in df.columns:
            renames['auto_gross_wt'] = 'auto_gross_weight'
        return df.rename(columns=renames) if renames else df

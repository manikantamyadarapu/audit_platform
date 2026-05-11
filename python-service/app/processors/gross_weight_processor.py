from decimal import Decimal
from typing import Any

import pandas as pd

from app.processors.base import BaseProcessor
from app.utils.audit_row_skips import should_skip_audit_row
from app.utils.constants import (
    GROSS_WEIGHT_DIFFERENCE_MESSAGE,
    GROSS_WEIGHT_MISMATCH_MESSAGE,
    NEGATIVE_WEIGHT_MESSAGE,
    SPREADSHEET_EMPTY_TOKENS,
)
from app.config.settings import get_settings
from app.utils.excel_header_detection import find_header_row_index, load_excel_with_header_row
from app.utils.excel_reader import ExcelReader
from app.utils.response_builder import build_processing_response
from app.utils.weight_decimal import parse_weight_decimal


def _gross_header_row_ok(labels: set[str]) -> bool:
    mg = 'manual_gross_weight' in labels or 'manual_gross_wt' in labels
    ag = 'auto_gross_weight' in labels or 'auto_gross_wt' in labels
    return mg and ag


class GrossWeightProcessor(BaseProcessor):
    REQUIRED_COLUMNS = {'manual_gross_weight', 'auto_gross_weight'}

    def __init__(self) -> None:
        self.reader = ExcelReader()
        self._match_epsilon = Decimal(str(get_settings().gross_weight_match_epsilon))

    def normalize_empty_value(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, float) and pd.isna(value):
            return None
        text = str(value).strip()
        if not text:
            return None
        if text.lower() in SPREADSHEET_EMPTY_TOKENS:
            return None
        return text

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        header_idx = find_header_row_index(file_bytes, _gross_header_row_ok)
        if header_idx is not None:
            df = load_excel_with_header_row(file_bytes, header_idx)
        else:
            df = self.reader.read_excel(file_bytes)
            header_idx = 0

        df = self._canonical_gross_columns(df)
        missing = self.REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise KeyError(f"Missing required columns: {', '.join(sorted(missing))}")

        columns_set = set(df.columns)

        mismatch_count = 0
        difference_violations = 0
        negative_value_violations = 0
        records: list[dict[str, Any]] = []

        for idx, row in df.iterrows():
            if should_skip_audit_row(
                row, columns_set, normalize_empty=self.normalize_empty_value
            ):
                continue

            manual_cell = row.get('manual_gross_weight')
            auto_cell = row.get('auto_gross_weight')

            man_dec = parse_weight_decimal(manual_cell)
            auto_dec = parse_weight_decimal(auto_cell)

            if man_dec is None or auto_dec is None:
                continue

            diff_cell = row.get('difference') if 'difference' in columns_set else None
            stated_diff = parse_weight_decimal(diff_cell)
            derived_diff = man_dec - auto_dec
            effective_diff = stated_diff if stated_diff is not None else derived_diff

            issues: list[str] = []
            messages: list[str] = []

            if man_dec < 0 or auto_dec < 0 or effective_diff < 0:
                negative_value_violations += 1
                issues.append('NEGATIVE_WEIGHT_VALUES')
                messages.append(NEGATIVE_WEIGHT_MESSAGE)
            elif abs(man_dec - auto_dec) > self._match_epsilon:
                mismatch_count += 1
                issues.append('GROSS_WEIGHT_MISMATCH')
                messages.append(GROSS_WEIGHT_MISMATCH_MESSAGE)
            elif abs(effective_diff) > self._match_epsilon:
                difference_violations += 1
                issues.append('GROSS_WEIGHT_DIFFERENCE_VIOLATION')
                messages.append(GROSS_WEIGHT_DIFFERENCE_MESSAGE)

            if issues:
                records.append(
                    {
                        'rowNumber': int(idx) + int(header_idx) + 2,
                        'manualGrossWeight': float(man_dec),
                        'autoGrossWeight': float(auto_dec),
                        'difference': float(effective_diff),
                        'issues': issues,
                        'messages': messages,
                    }
                )

        invalid_rows = negative_value_violations + mismatch_count + difference_violations
        weight_mismatch_total = invalid_rows

        return build_processing_response(
            file_type='gross_weight',
            total_rows=len(df),
            error_rows=invalid_rows,
            summary={
                'mismatchCount': mismatch_count,
                'differenceViolations': difference_violations,
                'negativeValueViolations': negative_value_violations,
                'weightMismatch': weight_mismatch_total,
            },
            records=records,
        )

    def _canonical_gross_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        renames: dict[str, str] = {}
        if 'manual_gross_wt' in df.columns:
            renames['manual_gross_wt'] = 'manual_gross_weight'
        if 'auto_gross_wt' in df.columns:
            renames['auto_gross_wt'] = 'auto_gross_weight'
        for alt in ('diff', 'weight_difference', 'gross_difference'):
            if alt in df.columns and 'difference' not in df.columns:
                renames[alt] = 'difference'
                break
        return df.rename(columns=renames) if renames else df

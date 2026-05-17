from decimal import Decimal
from time import perf_counter
from typing import Any

import polars as pl

from app.core.issue_engine import issue_message
from app.engines.vectorized_validation_engine import VectorizedValidationEngine
from app.config.settings import get_settings
from app.processors.base import BaseProcessor
from app.utils.constants import SPREADSHEET_EMPTY_TOKENS
from app.utils.response_builder import build_processing_response


def _gross_header_row_ok(labels: set[str]) -> bool:
    mg = 'manual_gross_weight' in labels or 'manual_gross_wt' in labels
    ag = 'auto_gross_weight' in labels or 'auto_gross_wt' in labels
    return mg and ag


class GrossWeightProcessor(BaseProcessor):
    REQUIRED_COLUMNS = {'manual_gross_weight', 'auto_gross_weight'}

    def __init__(self) -> None:
        self.engine = VectorizedValidationEngine('gross_weight')
        self._match_epsilon = Decimal(str(get_settings().gross_weight_match_epsilon))

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        total_start = perf_counter()
        loaded = self.engine.load_sheet(file_bytes, row_matches=_gross_header_row_ok)
        df = self._canonical_gross_columns(loaded.dataframe)
        data_columns = self.engine.user_columns(df)
        missing = self.REQUIRED_COLUMNS - set(data_columns)
        if missing:
            raise KeyError(f"Missing required columns: {', '.join(sorted(missing))}")

        validation_start = perf_counter()
        with self.engine.duckdb_connection(df) as connection:
            invalid_df = self.engine.fetch_frame(connection, self._validation_sql(data_columns))
        validation_ms = (perf_counter() - validation_start) * 1000

        extraction_start = perf_counter()
        mismatch_count = 0
        difference_violations = 0
        negative_value_violations = 0
        records: list[dict[str, Any]] = []

        for row in invalid_df.to_dicts():
            issue_code = str(row['issue_code'])
            if issue_code == 'NEGATIVE_WEIGHT_VALUES':
                negative_value_violations += 1
            elif issue_code == 'GROSS_WEIGHT_MISMATCH':
                mismatch_count += 1
            else:
                difference_violations += 1

            records.append(
                {
                    'rowNumber': int(row['row_number']),
                    'manualGrossWeight': float(row['manual_gross_weight']),
                    'autoGrossWeight': float(row['auto_gross_weight']),
                    'difference': float(row['difference']),
                    'issues': [issue_code],
                    'messages': [issue_message(issue_code)],
                }
            )

        extraction_ms = (perf_counter() - extraction_start) * 1000

        invalid_rows = negative_value_violations + mismatch_count + difference_violations
        weight_mismatch_total = invalid_rows

        total_ms = (perf_counter() - total_start) * 1000
        self.engine.log_benchmark(
            row_count=len(df),
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
            validation_ms=validation_ms,
            extraction_ms=extraction_ms,
            total_ms=total_ms,
        )

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

    def _canonical_gross_columns(self, df: pl.DataFrame) -> pl.DataFrame:
        renames: dict[str, str] = {}
        if 'manual_gross_wt' in df.columns:
            renames['manual_gross_wt'] = 'manual_gross_weight'
        if 'auto_gross_wt' in df.columns:
            renames['auto_gross_wt'] = 'auto_gross_weight'
        for alt in ('diff', 'weight_difference', 'gross_difference'):
            if alt in df.columns and 'difference' not in df.columns:
                renames[alt] = 'difference'
                break
        return df.rename(renames) if renames else df

    def _validation_sql(self, columns: list[str]) -> str:
        skip_sql = self.engine.shared_skip_sql(columns, empty_tokens=SPREADSHEET_EMPTY_TOKENS)
        manual_sql = self.engine.decimal_sql('manual_gross_weight', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
        auto_sql = self.engine.decimal_sql('auto_gross_weight', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
        difference_sql = (
            self.engine.decimal_sql('difference', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
            if 'difference' in columns
            else 'NULL'
        )
        epsilon_sql = f"CAST({str(self._match_epsilon)} AS DECIMAL(18, 6))"
        return f"""
WITH parsed AS (
    SELECT
        "__excel_row_number__" AS excel_row_number,
        {manual_sql} AS manual_weight,
        {auto_sql} AS auto_weight,
        {difference_sql} AS stated_difference,
        {skip_sql} AS should_skip
    FROM source_rows
),
evaluated AS (
    SELECT
        excel_row_number,
        manual_weight,
        auto_weight,
        COALESCE(stated_difference, manual_weight - auto_weight) AS effective_difference,
        CASE
            WHEN should_skip OR manual_weight IS NULL OR auto_weight IS NULL THEN NULL
            WHEN manual_weight < 0 OR auto_weight < 0
                OR COALESCE(stated_difference, manual_weight - auto_weight) < 0
                THEN 'NEGATIVE_WEIGHT_VALUES'
            WHEN ABS(manual_weight - auto_weight) > {epsilon_sql}
                THEN 'GROSS_WEIGHT_MISMATCH'
            WHEN ABS(COALESCE(stated_difference, manual_weight - auto_weight)) > {epsilon_sql}
                THEN 'GROSS_WEIGHT_DIFFERENCE_VIOLATION'
            ELSE NULL
        END AS issue_code
    FROM parsed
)
SELECT
    CAST(excel_row_number AS BIGINT) AS row_number,
    CAST(manual_weight AS DOUBLE) AS manual_gross_weight,
    CAST(auto_weight AS DOUBLE) AS auto_gross_weight,
    CAST(effective_difference AS DOUBLE) AS difference,
    issue_code
FROM evaluated
WHERE issue_code IS NOT NULL
ORDER BY row_number
"""

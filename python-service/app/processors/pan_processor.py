import re
from datetime import date, datetime
from pathlib import Path
from time import perf_counter
from typing import Any

import pandas as pd

from app.core.issue_engine import messages_for_codes
from app.config.settings import get_settings
from app.engines.vectorized_validation_engine import VectorizedValidationEngine
from app.processors.base import BaseProcessor
from app.utils.constants import (
    SPREADSHEET_EMPTY_TOKENS,
    is_acceptable_pan_equivalent,
)
from app.utils.response_builder import build_processing_response


class PanProcessor(BaseProcessor):
    REQUIRED_BASE_COLUMNS = {'total_value'}
    PAN_COLUMN_OPTIONS = {'pan', 'pan1'}
    ADDRESS_COLUMN_OPTIONS = {'add_proof', 'add_proof_2'}

    def __init__(self) -> None:
        self.engine = VectorizedValidationEngine('pan')

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        total_start = perf_counter()
        try:
            loaded = self.engine.load_sheet(file_bytes, row_matches=self._headers_match_pan_sheet)
        except Exception as exc:
            raise ValueError('Invalid or unreadable Excel file') from exc

        df = loaded.dataframe
        data_columns = self.engine.user_columns(df)
        self._validate_required_columns(data_columns)
        total_rows = len(df)

        validation_start = perf_counter()
        with self.engine.duckdb_connection(df) as connection:
            invalid_df = self.engine.fetch_frame(connection, self._validation_sql(data_columns))
        validation_ms = (perf_counter() - validation_start) * 1000

        extraction_start = perf_counter()
        records: list[dict[str, Any]] = []
        missing_pan_count = int(invalid_df['missing_pan_issue'].sum() or 0)
        invalid_pan_format_count = int(invalid_df['invalid_pan_issue'].sum() or 0)
        missing_address_proof_count = int(invalid_df['missing_address_issue'].sum() or 0)

        # Include all columns from original dataframe
        flag_cols = ['missing_pan_issue', 'invalid_pan_issue', 'missing_address_issue']
        
        # Convert original df to dict format for quick row lookup by row_number (Polars uses .to_dicts())
        df_dict_list = df.to_dicts()
        df_by_row_num = {}
        for idx, row_dict in enumerate(df_dict_list, 1):
            df_by_row_num[idx] = row_dict

        for invalid_row in invalid_df.to_dicts():
            row_num = invalid_row.get('row_number')
            original_row = df_by_row_num.get(row_num, {})
            
            issues: list[str] = []
            if invalid_row.get('missing_pan_issue'):
                issues.append('MISSING_PAN_ABOVE_2L')
            if invalid_row.get('invalid_pan_issue'):
                issues.append('INVALID_PAN_FORMAT')
            if invalid_row.get('missing_address_issue'):
                issues.append('MISSING_ADDRESS_PROOF_ABOVE_50K')

            # Build record with all original columns
            record = {'rowNumber': self._json_value(row_num)}
            
            # Add all columns from original dataframe
            for col in data_columns:
                col_value = original_row.get(col)
                # Use camelCase for output
                camel_col = self._to_camel_case(col)
                if col in ['date']:
                    record[camel_col] = self._format_cell_value(col_value)
                else:
                    record[camel_col] = self._json_value(col_value) if isinstance(col_value, (int, float)) else self._format_cell_value(col_value)
            
            record['issues'] = issues
            record['messages'] = self._messages_for_issues(issues)
            records.append(record)

        extraction_ms = (perf_counter() - extraction_start) * 1000
        self.engine.log_benchmark(
            row_count=total_rows,
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
            validation_ms=validation_ms,
            extraction_ms=extraction_ms,
            total_ms=(perf_counter() - total_start) * 1000,
        )

        summary = {
            'missingPanCount': missing_pan_count,
            'invalidPanFormatCount': invalid_pan_format_count,
            'missingAddressProofCount': missing_address_proof_count,
            'missingPanAbove2L': missing_pan_count,
            'invalidPanFormat': invalid_pan_format_count,
            'missingAddressProofAbove50K': missing_address_proof_count,
        }

        if get_settings().debug_exports_enabled():
            self._export_issue_rows_debug(records)

        return build_processing_response(
            file_type='pan',
            total_rows=total_rows,
            error_rows=len(records),
            summary=summary,
            records=records,
        )

    def _export_issue_rows_debug(self, records: list[dict[str, Any]]) -> None:
        if not records:
            return

        issue_rows = pd.DataFrame(records).head(200)

        output_path = (
            Path(__file__).resolve().parents[2]
            / "pan_issue_rows_debug.xlsx"
        )
        issue_rows.to_excel(output_path, index=False)

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

    def parse_amount(self, value: Any) -> float | int | None:
        if value is None:
            return None
        if isinstance(value, (int, float)) and not pd.isna(value):
            return int(value) if float(value).is_integer() else float(value)

        text = str(value).strip()
        if not text:
            return None
        if text.lower() in SPREADSHEET_EMPTY_TOKENS:
            return None

        cleaned = re.sub(r'[^0-9.\-]', '', text.replace(',', ''))
        if cleaned.count('.') > 1:
            parts = cleaned.split('.')
            cleaned = f"{''.join(parts[:-1])}.{parts[-1]}"
        if cleaned in {'', '-', '.', '-.'}:
            return None

        number = float(cleaned)
        return int(number) if number.is_integer() else number

    @staticmethod
    def _messages_for_issues(issues: list[str]) -> list[str]:
        return messages_for_codes(issues)

    def _collect_pan_issues(
        self, total_value: float | int | None, pan_norm: str | None, pan1_norm: str | None
    ) -> list[str]:
        if total_value is None or total_value < 200000:
            return []

        pan_ok = pan_norm is not None and self.is_valid_pan(pan_norm)
        pan1_ok = pan1_norm is not None and self.is_valid_pan(pan1_norm)

        if pan_ok or pan1_ok:
            return []
        if pan_norm is None and pan1_norm is None:
            return ['MISSING_PAN_ABOVE_2L']
        return ['INVALID_PAN_FORMAT']

    def _collect_address_proof_issue(
        self,
        total_value: float | int | None,
        add_proof: str | None,
        add_proof_2: str | None,
    ) -> str | None:
        if total_value is None or total_value < 50000:
            return None

        if add_proof or add_proof_2:
            return None

        return 'MISSING_ADDRESS_PROOF_ABOVE_50K'

    def is_valid_pan(self, pan_value: str) -> bool:
        return is_acceptable_pan_equivalent(pan_value)

    def _validate_required_columns(self, columns: Any) -> None:
        column_set = set(columns)
        missing_base = self.REQUIRED_BASE_COLUMNS - column_set
        if missing_base:
            raise KeyError(f"Missing required columns: {', '.join(sorted(missing_base))}")

        missing_pan_columns = self.PAN_COLUMN_OPTIONS - column_set
        if missing_pan_columns:
            raise KeyError(f"Missing required columns: {', '.join(sorted(missing_pan_columns))}")

        if not (column_set & self.ADDRESS_COLUMN_OPTIONS):
            raise KeyError('Missing required columns: add_proof or add_proof_2')

    def _columns_sufficient_for_pan(self, cols: set[str]) -> bool:
        if not cols & self.ADDRESS_COLUMN_OPTIONS:
            return False
        return 'pan' in cols or 'pan1' in cols

    def _headers_match_pan_sheet(self, headers: set[str]) -> bool:
        if 'total_value' not in headers or not ('pan' in headers or 'pan1' in headers):
            return False
        return bool(headers & self.ADDRESS_COLUMN_OPTIONS)

    def _format_cell_value(self, value: Any) -> str:
        if value is None:
            return ''
        if pd.isna(value):
            return ''
        if isinstance(value, pd.Timestamp):
            return value.strftime('%d-%m-%Y')
        if isinstance(value, datetime):
            return value.strftime('%d-%m-%Y')
        if isinstance(value, date):
            return value.strftime('%d-%m-%Y')
        return str(value).strip()

    def _json_value(self, value: Any) -> Any:
        if value is None:
            return None
        if pd.isna(value):
            return None
        if hasattr(value, 'item'):
            return value.item()
        return value

    def _validation_sql(self, columns: list[str]) -> str:
        skip_sql = self.engine.shared_skip_sql(columns, empty_tokens=SPREADSHEET_EMPTY_TOKENS)
        total_value_sql = self.engine.amount_sql('total_value', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
        pan_sql = self.engine.blankable_text_sql('pan', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
        pan1_sql = self.engine.blankable_text_sql('pan1', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
        add_proof_sql = (
            self.engine.blankable_text_sql('add_proof', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
            if 'add_proof' in columns
            else 'NULL'
        )
        add_proof_2_sql = (
            self.engine.blankable_text_sql('add_proof_2', empty_tokens=SPREADSHEET_EMPTY_TOKENS)
            if 'add_proof_2' in columns
            else 'NULL'
        )
        return f"""
WITH parsed AS (
    SELECT
        CAST("__excel_row_number__" AS BIGINT) AS row_number,
        {self._raw_column_sql(columns, 'date')} AS date,
        {self._raw_column_sql(columns, 'voucher_no')} AS voucher_no,
        {self._raw_column_sql(columns, 'party')} AS party,
        {self._raw_column_sql(columns, 'pan')} AS pan,
        {self._raw_column_sql(columns, 'pan1')} AS pan1,
        {self._raw_column_sql(columns, 'add_proof')} AS add_proof,
        {self._raw_column_sql(columns, 'add_proof_2')} AS add_proof_2,
        {total_value_sql} AS total_value,
        {pan_sql} AS pan_text,
        {pan1_sql} AS pan1_text,
        {add_proof_sql} AS add_proof_text,
        {add_proof_2_sql} AS add_proof_2_text,
        {skip_sql} AS should_skip
    FROM source_rows
),
validated AS (
    SELECT
        *,
        (
            REGEXP_MATCHES(
                UPPER(REGEXP_REPLACE(COALESCE(pan_text, ''), '\\s+', '', 'g')),
                '^[A-Z]{{5}}[0-9]{{4}}[A-Z]{{1}}$'
            )
            OR REGEXP_REPLACE(LOWER(COALESCE(pan_text, '')), '[^a-z0-9]', '', 'g') IN ('formno60', 'usdl')
        ) AS pan_ok,
        (
            REGEXP_MATCHES(
                UPPER(REGEXP_REPLACE(COALESCE(pan1_text, ''), '\\s+', '', 'g')),
                '^[A-Z]{{5}}[0-9]{{4}}[A-Z]{{1}}$'
            )
            OR REGEXP_REPLACE(LOWER(COALESCE(pan1_text, '')), '[^a-z0-9]', '', 'g') IN ('formno60', 'usdl')
        ) AS pan1_ok
    FROM parsed
)
SELECT
    row_number,
    date,
    voucher_no,
    party,
    total_value,
    pan,
    pan1,
    add_proof,
    add_proof_2,
    (
        NOT should_skip
        AND total_value > 200000
        AND NOT (pan_ok OR pan1_ok)
        AND pan_text IS NULL
        AND pan1_text IS NULL
    ) AS missing_pan_issue,
    (
        NOT should_skip
        AND total_value > 200000
        AND NOT (pan_ok OR pan1_ok)
        AND NOT (pan_text IS NULL AND pan1_text IS NULL)
    ) AS invalid_pan_issue,
    (
        NOT should_skip
        AND total_value > 50000
        AND add_proof_text IS NULL
        AND add_proof_2_text IS NULL
    ) AS missing_address_issue
FROM validated
WHERE
    (
        NOT should_skip
        AND total_value > 200000
        AND NOT (pan_ok OR pan1_ok)
    )
    OR (
        NOT should_skip
        AND total_value > 50000
        AND add_proof_text IS NULL
        AND add_proof_2_text IS NULL
    )
ORDER BY row_number
"""

    def _raw_column_sql(self, columns: list[str], column: str) -> str:
        if column not in columns:
            return 'NULL'
        return self.engine.quote_identifier(column)

    @staticmethod
    def _to_camel_case(snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split('_')
        return components[0] + ''.join(x.title() for x in components[1:])

import re
from datetime import date, datetime
from time import perf_counter
from typing import Any

import pandas as pd

from app.core.issue_engine import messages_for_codes
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
        missing_pan_count = 0
        invalid_pan_format_count = 0
        missing_address_proof_count = 0

        for row in invalid_df.to_dicts():
            issues: list[str] = []
            if row['missing_pan_issue']:
                issues.append('MISSING_PAN_ABOVE_2L')
                missing_pan_count += 1
            elif row['invalid_pan_issue']:
                issues.append('INVALID_PAN_FORMAT')
                invalid_pan_format_count += 1
            if row['missing_address_issue']:
                issues.append('MISSING_ADDRESS_PROOF_ABOVE_50K')
                missing_address_proof_count += 1

            messages = self._messages_for_issues(issues)
            pan = self.normalize_empty_value(row.get('pan'))
            pan1 = self.normalize_empty_value(row.get('pan1'))
            add_proof = self.normalize_empty_value(row.get('add_proof'))
            add_proof_2 = self.normalize_empty_value(row.get('add_proof_2'))

            records.append(
                {
                    'rowNumber': int(row['row_number']),
                    'date': self._format_cell_value(row.get('date')),
                    'voucherNo': self._format_cell_value(row.get('voucher_no')),
                    'party': self._format_cell_value(row.get('party')),
                    'totalValue': row.get('total_value'),
                    'pan': pan or '',
                    'pan1': pan1 or '',
                    'addProof': add_proof or '',
                    'addProof2': add_proof_2 or '',
                    'issues': issues,
                    'messages': messages,
                }
            )

        extraction_ms = (perf_counter() - extraction_start) * 1000

        summary = {
            'missingPanCount': missing_pan_count,
            'invalidPanFormatCount': invalid_pan_format_count,
            'missingAddressProofCount': missing_address_proof_count,
            'missingPanAbove2L': missing_pan_count,
            'invalidPanFormat': invalid_pan_format_count,
            'missingAddressProofAbove50K': missing_address_proof_count,
        }

        total_ms = (perf_counter() - total_start) * 1000
        self.engine.log_benchmark(
            row_count=total_rows,
            header_row_index=loaded.header_row_index,
            header_detection_ms=loaded.header_detection_ms,
            load_ms=loaded.load_ms,
            validation_ms=validation_ms,
            extraction_ms=extraction_ms,
            total_ms=total_ms,
        )

        return build_processing_response(
            file_type='pan',
            total_rows=total_rows,
            error_rows=len(records),
            summary=summary,
            records=records,
        )

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
        if total_value is None or total_value <= 200000:
            return []

        pan_ok = pan_norm is not None and self.is_valid_pan(pan_norm)
        pan1_ok = pan1_norm is not None and self.is_valid_pan(pan1_norm)

        if pan_ok or pan1_ok:
            return []
        if pan_norm is None and pan1_norm is None:
            return ['MISSING_PAN_ABOVE_2L']
        return ['INVALID_PAN_FORMAT']

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

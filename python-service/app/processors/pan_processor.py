import re
from datetime import date, datetime
from typing import Any

import pandas as pd

from app.processors.base import BaseProcessor
from app.utils.constants import PAN_REGEX
from app.utils.excel_header_detection import find_header_row_index, load_excel_with_header_row
from app.utils.excel_reader import ExcelReader
from app.utils.response_builder import build_processing_response


class PanProcessor(BaseProcessor):
    REQUIRED_BASE_COLUMNS = {'total_value'}
    PAN_COLUMN_OPTIONS = {'pan', 'pan1'}
    ADDRESS_COLUMN_OPTIONS = {'add_proof', 'add_proof_2'}
    EMPTY_VALUES = {'', 'pending', 'na', 'n/a', 'none', 'null', 'nan', '-', '----'}

    def __init__(self) -> None:
        self.reader = ExcelReader()
        self._pan_pattern = re.compile(PAN_REGEX)

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        try:
            df, header_row_index = self._read_pan_dataframe(file_bytes)
        except Exception as exc:
            raise ValueError('Invalid or unreadable Excel file') from exc

        self._validate_required_columns(df.columns)
        total_rows = len(df)

        records: list[dict[str, Any]] = []
        missing_pan_above_2l = 0
        missing_address_above_50k = 0
        invalid_pan_format = 0

        for _, chunk in self.reader.iter_chunks(df):
            for idx, row in chunk.iterrows():
                if self._is_blank_row(row):
                    continue

                total_value = self.parse_amount(row.get('total_value'))
                pan = self.normalize_empty_value(row.get('pan'))
                pan1 = self.normalize_empty_value(row.get('pan1'))
                add_proof = self.normalize_empty_value(row.get('add_proof'))
                add_proof_2 = self.normalize_empty_value(row.get('add_proof_2'))
                issues: list[str] = []

                pan_issues = self._collect_pan_issues(total_value, pan, pan1)
                for issue in pan_issues:
                    if issue == 'MISSING_PAN_ABOVE_2L':
                        missing_pan_above_2l += 1
                    elif issue == 'INVALID_PAN_FORMAT':
                        invalid_pan_format += 1
                issues.extend(pan_issues)

                if total_value is not None and total_value > 50000 and not (add_proof or add_proof_2):
                    issues.append('MISSING_ADDRESS_PROOF_ABOVE_50K')
                    missing_address_above_50k += 1

                if issues:
                    records.append(
                        {
                            'rowNumber': int(idx) + header_row_index + 2,
                            'date': self._format_cell_value(row.get('date')),
                            'voucherNo': self._format_cell_value(row.get('voucher_no')),
                            'party': self._format_cell_value(row.get('party')),
                            'totalValue': total_value,
                            'pan': pan or '',
                            'pan1': pan1 or '',
                            'addProof': add_proof or '',
                            'addProof2': add_proof_2 or '',
                            'issues': issues,
                        }
                    )

        return build_processing_response(
            file_type='pan',
            total_rows=total_rows,
            error_rows=len(records),
            summary={
                'missingPanAbove2L': missing_pan_above_2l,
                'missingAddressProofAbove50K': missing_address_above_50k,
                'invalidPanFormat': invalid_pan_format,
            },
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
        if text.lower() in self.EMPTY_VALUES:
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
        if text.lower() in self.EMPTY_VALUES:
            return None

        cleaned = re.sub(r'[^0-9.\-]', '', text.replace(',', ''))
        if cleaned.count('.') > 1:
            parts = cleaned.split('.')
            cleaned = f"{''.join(parts[:-1])}.{parts[-1]}"
        if cleaned in {'', '-', '.', '-.'}:
            return None

        number = float(cleaned)
        return int(number) if number.is_integer() else number

    def _collect_pan_issues(
        self, total_value: float | int | None, pan_norm: str | None, pan1_norm: str | None
    ) -> list[str]:
        pan_ok = pan_norm is not None and self.is_valid_pan(pan_norm)
        pan1_ok = pan1_norm is not None and self.is_valid_pan(pan1_norm)

        if total_value is not None and total_value > 200000:
            if pan_ok or pan1_ok:
                return []
            if pan_norm is None and pan1_norm is None:
                return ['MISSING_PAN_ABOVE_2L']
            return ['INVALID_PAN_FORMAT']

        if pan_ok or pan1_ok:
            return []

        pan_bad = pan_norm is not None and not self.is_valid_pan(pan_norm)
        pan1_bad = pan1_norm is not None and not self.is_valid_pan(pan1_norm)
        if pan_bad or pan1_bad:
            return ['INVALID_PAN_FORMAT']
        return []

    def is_valid_pan(self, pan_value: str) -> bool:
        return bool(self._pan_pattern.fullmatch(pan_value.strip().upper()))

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

    def _read_pan_dataframe(self, file_bytes: bytes) -> tuple[pd.DataFrame, int]:
        dataframe = self.reader.read_excel(file_bytes)
        if 'total_value' in dataframe.columns and self._columns_sufficient_for_pan(set(dataframe.columns)):
            return dataframe, 0

        header_row_index = find_header_row_index(file_bytes, self._headers_match_pan_sheet)
        if header_row_index is None:
            return dataframe, 0

        dataframe = load_excel_with_header_row(file_bytes, header_row_index)
        return dataframe, header_row_index

    def _columns_sufficient_for_pan(self, cols: set[str]) -> bool:
        if not cols & self.ADDRESS_COLUMN_OPTIONS:
            return False
        return 'pan' in cols or 'pan1' in cols

    def _headers_match_pan_sheet(self, headers: set[str]) -> bool:
        if 'total_value' not in headers or not ('pan' in headers or 'pan1' in headers):
            return False
        return bool(headers & self.ADDRESS_COLUMN_OPTIONS)

    def _is_blank_row(self, row: pd.Series) -> bool:
        for value in row.values:
            if self.normalize_empty_value(value) is not None:
                return False
        return True

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

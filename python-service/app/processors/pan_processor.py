import re
import time
from datetime import date, datetime
from io import BytesIO
from typing import Any

import pandas as pd
from openpyxl import load_workbook

from app.config.settings import get_settings
from app.processors.base import BaseProcessor
from app.utils.constants import PAN_REGEX
from app.utils.excel_reader import ExcelReader, effective_excel_max_row
from app.utils.header_cleaner import normalize_headers
from app.utils.response_builder import build_processing_response


class PanProcessor(BaseProcessor):
    REQUIRED_BASE_COLUMNS = {'total_value'}
    PAN_COLUMN_OPTIONS = {'pan', 'pan1'}
    ADDRESS_COLUMN_OPTIONS = {'add_proof', 'add_proof_2'}
    EMPTY_VALUES = {'', 'pending', 'na', 'n/a', 'none', 'null', 'nan', '-', '----'}

    def __init__(self) -> None:
        self.reader = ExcelReader()
        self._pan_pattern = re.compile(PAN_REGEX)

    def process(self, file_bytes: bytes, **kwargs: Any) -> dict[str, Any]:
        t_wall = time.perf_counter()
        stream = self._try_process_openpyxl_stream(file_bytes)
        if stream is not None:
            (
                records,
                total_rows,
                missing_pan_above_2l,
                missing_address_above_50k,
                invalid_pan_format,
                row_stats,
                read_ms,
                parse_ms,
            ) = stream
            validate_ms = 0.0
        else:
            t_read = time.perf_counter()
            try:
                df, header_row_index = self._read_pan_dataframe(file_bytes)
            except Exception as exc:
                raise ValueError('Invalid or unreadable Excel file') from exc
            read_ms = (time.perf_counter() - t_read) * 1000.0

            self._validate_required_columns(df.columns)
            total_rows = len(df)

            t_parse = time.perf_counter()
            records = []
            missing_pan_above_2l = 0
            missing_address_above_50k = 0
            invalid_pan_format = 0
            blank_skipped = 0

            for _, chunk in self.reader.iter_chunks(df):
                for idx, row in chunk.iterrows():
                    if self._is_blank_row(row):
                        blank_skipped += 1
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
            parse_ms = (time.perf_counter() - t_parse) * 1000.0
            validate_ms = 0.0
            row_stats = {
                'dataRowsScanned': total_rows,
                'blankRowsSkipped': blank_skipped,
                'parsedRows': total_rows - blank_skipped,
                'headerRowExcel': header_row_index + 1,
                'scanCapTruncated': False,
                'engine': 'pandas',
            }

        wall_ms = (time.perf_counter() - t_wall) * 1000.0
        rps = (total_rows / (wall_ms / 1000.0)) if wall_ms > 1e-6 else 0.0

        performance = {
            'readTimeMs': round(read_ms, 3),
            'parseTimeMs': round(parse_ms, 3),
            'validateTimeMs': round(validate_ms, 3),
            'rowsPerSecond': round(rps, 2),
            'wallTimeMs': round(wall_ms, 3),
        }

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
            performance=performance,
            row_stats=row_stats,
        )

    def _try_process_openpyxl_stream(
        self, file_bytes: bytes
    ) -> tuple[
        list[dict[str, Any]],
        int,
        int,
        int,
        int,
        dict[str, Any],
        float,
        float,
    ] | None:
        """Fast path: first sheet, ``read_only`` + ``data_only``, row iteration (no full DataFrame)."""
        settings = get_settings()
        probe_limit = max(25, settings.excel_pan_header_probe_rows)
        t_read = time.perf_counter()
        wb = None
        try:
            wb = load_workbook(BytesIO(file_bytes), read_only=True, data_only=True, keep_links=False)
        except Exception:
            return None
        read_ms = (time.perf_counter() - t_read) * 1000.0

        try:
            ws = wb[wb.sheetnames[0]]
            probe_rows = list(
                ws.iter_rows(min_row=1, max_row=probe_limit, values_only=True),
            )
            header_info = self._pan_header_from_probe_rows(probe_rows)
            if header_info is None:
                return None
            excel_header_row, col_indices = header_info
            self._validate_required_columns(set(col_indices.keys()))

            ws_max = ws.max_row or 0
            eff_max, truncated = effective_excel_max_row(ws_max, settings.excel_max_rows)

            records: list[dict[str, Any]] = []
            missing_pan_above_2l = 0
            missing_address_above_50k = 0
            invalid_pan_format = 0
            blank_skipped = 0
            data_rows = 0

            t_parse = time.perf_counter()
            for row_tuple in ws.iter_rows(
                min_row=excel_header_row + 1,
                max_row=eff_max,
                values_only=True,
            ):
                data_rows += 1
                row_map = self._row_map_from_tuple(row_tuple, col_indices)
                if self._is_blank_row_mapping(row_map):
                    blank_skipped += 1
                    continue

                total_value = self.parse_amount(row_map.get('total_value'))
                pan = self.normalize_empty_value(row_map.get('pan'))
                pan1 = self.normalize_empty_value(row_map.get('pan1'))
                add_proof = self.normalize_empty_value(row_map.get('add_proof'))
                add_proof_2 = self.normalize_empty_value(row_map.get('add_proof_2'))
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
                    excel_row = excel_header_row + data_rows
                    records.append(
                        {
                            'rowNumber': excel_row,
                            'date': self._format_cell_value(row_map.get('date')),
                            'voucherNo': self._format_cell_value(row_map.get('voucher_no')),
                            'party': self._format_cell_value(row_map.get('party')),
                            'totalValue': total_value,
                            'pan': pan or '',
                            'pan1': pan1 or '',
                            'addProof': add_proof or '',
                            'addProof2': add_proof_2 or '',
                            'issues': issues,
                        }
                    )
            parse_ms = (time.perf_counter() - t_parse) * 1000.0

            row_stats = {
                'dataRowsScanned': data_rows,
                'blankRowsSkipped': blank_skipped,
                'parsedRows': data_rows - blank_skipped,
                'headerRowExcel': excel_header_row,
                'scanCapTruncated': truncated,
                'engine': 'openpyxl_read_only',
            }
            return (
                records,
                data_rows,
                missing_pan_above_2l,
                missing_address_above_50k,
                invalid_pan_format,
                row_stats,
                read_ms,
                parse_ms,
            )
        except KeyError:
            raise
        except Exception:
            return None
        finally:
            if wb is not None:
                wb.close()

    def _pan_header_from_probe_rows(
        self, probe_rows: list[tuple[Any, ...]]
    ) -> tuple[int, dict[str, int]] | None:
        for i, row_tuple in enumerate(probe_rows):
            labels = [str(x).strip() if x is not None else '' for x in list(row_tuple)]
            headers = normalize_headers(labels)
            header_set = {h for h in headers if h}
            if 'total_value' in header_set and ('pan' in header_set or 'pan1' in header_set):
                col_indices: dict[str, int] = {}
                for j, h in enumerate(headers):
                    if h and h not in col_indices:
                        col_indices[h] = j
                return i + 1, col_indices
        return None

    def _row_map_from_tuple(self, row_tuple: tuple[Any, ...], col_indices: dict[str, int]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for name, j in col_indices.items():
            if j < len(row_tuple):
                out[name] = row_tuple[j]
            else:
                out[name] = None
        return out

    def _is_blank_row_mapping(self, row_map: dict[str, Any]) -> bool:
        for value in row_map.values():
            if self.normalize_empty_value(value) is not None:
                return False
        return True

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
        if 'total_value' in dataframe.columns:
            return dataframe, 0

        header_row_index = self._detect_header_row_index(file_bytes)
        if header_row_index is None:
            return dataframe, 0

        dataframe = pd.read_excel(BytesIO(file_bytes), engine='openpyxl', header=header_row_index)
        dataframe.columns = normalize_headers(dataframe.columns)
        return dataframe, header_row_index

    def _detect_header_row_index(self, file_bytes: bytes) -> int | None:
        settings = get_settings()
        nrows = max(25, settings.excel_pan_header_probe_rows)
        preview = pd.read_excel(BytesIO(file_bytes), engine='openpyxl', header=None, nrows=nrows)
        for idx, row in preview.iterrows():
            headers = {header for header in normalize_headers(row.tolist()) if header}
            if 'total_value' in headers and ('pan' in headers or 'pan1' in headers):
                return int(idx)
        return None

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

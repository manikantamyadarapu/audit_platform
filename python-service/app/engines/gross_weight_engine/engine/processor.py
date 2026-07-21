from decimal import Decimal
from io import BytesIO
from typing import Any

import polars as pl
import pandas as pd

from app.core.issue_engine import issue_message
from app.core.vectorized_validation_engine import VectorizedValidationEngine
from app.config.settings import get_settings
from app.core.base_processor import BaseProcessor
from app.utils.audit_row_skips import should_skip_audit_row
from app.utils.constants import SPREADSHEET_EMPTY_TOKENS
from app.utils.excel_reader import ExcelReader
from app.utils.header_cleaner import normalize_headers
from app.utils.response_builder import build_processing_response
from app.utils.weight_decimal import parse_weight_decimal

GROSS_EXCLUDED_RECORD_FIELDS = frozenset({
    "date",
    "party",
    "sno",
    "value_row_index",
    "voucher_row_index",
})

GROSS_RECORD_FIELD_ORDER = (
    "voucher_no",
    "manual_gross_weight",
    "auto_gross_weight",
    "difference",
)


class GrossWeightProcessor(BaseProcessor):
    def __init__(self) -> None:
        self.reader = ExcelReader()
        # Treat tiny rounding/noise differences as valid.
        # Business expectation: values like 0.003 / -0.004 should not be flagged.
        self._match_epsilon = Decimal("0.005")

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
        df = self._read_gross_weight_dataframe(file_bytes)
        df = self._canonical_gross_columns(df)

        normalized_df = self._normalize_cross_format_to_flat(df)

        invalid_rows_df = self._filter_invalid_difference_rows(normalized_df)
        negative_invalid_count, positive_invalid_count = self._count_invalid_rows_by_sign(
            invalid_rows_df
        )

        records = self._records_from_invalid_rows(invalid_rows_df)

        return build_processing_response(
            file_type="gross_weight",
            total_rows=len(normalized_df),
            error_rows=len(invalid_rows_df),
            summary={
                "mismatchCount": len(invalid_rows_df),
                "differenceViolations": 0,
                "negativeValueViolations": negative_invalid_count,
                "positiveInvalidCount": positive_invalid_count,
                "weightMismatch": len(invalid_rows_df),
            },
            records=records,
        )

    def _read_gross_weight_dataframe(self, file_bytes: bytes) -> pd.DataFrame:
        raw_df = pd.read_excel(BytesIO(file_bytes), engine="openpyxl", header=None)
        header_row_index = self._find_gross_weight_header_row(raw_df)

        if header_row_index is None:
            dataframe = self.reader.read_excel(file_bytes)
            return dataframe

        dataframe = raw_df.iloc[header_row_index + 1 :].copy()
        dataframe.columns = normalize_headers(raw_df.iloc[header_row_index].tolist())
        dataframe = dataframe.reset_index(drop=True)

        return dataframe

    def _find_gross_weight_header_row(self, raw_df: pd.DataFrame) -> int | None:
        for idx, row in raw_df.iterrows():
            first_cell = row.iloc[0] if len(row) else None
            if self._is_sno_header_cell(first_cell):
                return int(idx)

        return None

    def _is_sno_header_cell(self, value: Any) -> bool:
        if value is None:
            return False

        if isinstance(value, float) and pd.isna(value):
            return False

        normalized = "".join(
            char for char in str(value).strip().lower() if char.isalnum()
        )
        return normalized in {"sno", "srno"}

    def _effective_difference_series(self, dataframe: pd.DataFrame) -> pd.Series:
        if dataframe.empty or 'difference' not in dataframe.columns:
            return pd.Series(dtype=object)
        return dataframe['difference'].map(parse_weight_decimal)

    def _filter_invalid_difference_rows(
        self,
        normalized_df: pd.DataFrame,
    ) -> pd.DataFrame:
        if normalized_df.empty:
            return normalized_df.copy()

        effective = self._effective_difference_series(normalized_df)
        epsilon = float(self._match_epsilon)
        mask = effective.notna() & (effective.abs() > epsilon)
        return normalized_df.loc[mask].copy()

    def _count_invalid_rows_by_sign(
        self,
        invalid_rows_df: pd.DataFrame,
    ) -> tuple[int, int]:
        if invalid_rows_df.empty:
            return 0, 0

        effective = self._effective_difference_series(invalid_rows_df)
        negative_invalid_count = int((effective < 0).sum())
        positive_invalid_count = int((effective > 0).sum())
        return negative_invalid_count, positive_invalid_count

    def _records_from_invalid_rows(
        self,
        invalid_rows_df: pd.DataFrame,
    ) -> list[dict[str, Any]]:
        if invalid_rows_df.empty:
            return []

        effective = self._effective_difference_series(invalid_rows_df)
        records: list[dict[str, Any]] = []

        for row, diff_val in zip(invalid_rows_df.itertuples(index=False), effective):
            if diff_val is None:
                continue

            record: dict[str, Any] = {}

            for col in invalid_rows_df.columns:
                if col in GROSS_EXCLUDED_RECORD_FIELDS:
                    continue
                col_value = getattr(row, col, None)
                camel_col = self._to_camel_case(col)
                if camel_col in self._excluded_camel_record_fields():
                    continue
                record[camel_col] = self._json_value(col_value)

            row_number = getattr(row, "sno", None)
            if row_number is None:
                row_number = getattr(row, "value_row_index", None)
            if row_number is not None:
                record["rowNumber"] = self._json_value(row_number)

            message = issue_message("GROSS_WEIGHT_MISMATCH")
            record["Message"] = message
            record["messages"] = [message]
            record["issues"] = ["GROSS_WEIGHT_MISMATCH"]
            records.append(self._order_gross_record(record))

        return records

    @staticmethod
    def _excluded_camel_record_fields() -> frozenset[str]:
        return frozenset(
            GrossWeightProcessor._to_camel_case(column)
            for column in GROSS_EXCLUDED_RECORD_FIELDS
        ) | frozenset({"valueRowIndex", "voucherRowIndex", "sno"})

    @staticmethod
    def _order_gross_record(record: dict[str, Any]) -> dict[str, Any]:
        issues = record.pop("issues", [])
        messages = record.pop("messages", None)
        message = record.pop("Message", None)
        row_number = record.pop("rowNumber", None)

        priority = [
            GrossWeightProcessor._to_camel_case(column)
            for column in GROSS_RECORD_FIELD_ORDER
        ]
        ordered: dict[str, Any] = {}
        if row_number is not None:
            ordered["rowNumber"] = row_number
        for key in priority:
            if key in record:
                ordered[key] = record.pop(key)
        for key in sorted(record):
            ordered[key] = record[key]
        if message is not None:
            ordered["Message"] = message
        if messages is not None:
            ordered["messages"] = messages
        ordered["issues"] = issues
        return ordered

    @staticmethod
    def _to_camel_case(snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        components = snake_str.split('_')
        return components[0] + ''.join(x.title() for x in components[1:])

    def _json_value(self, value: Any) -> Any:
        if value is None:
            return None

        if isinstance(value, float) and pd.isna(value):
            return None

        if pd.isna(value):
            return None

        if isinstance(value, Decimal):
            return float(value)

        if hasattr(value, "item"):
            return value.item()

        return value

    def _normalize_cross_format_to_flat(
        self,
        df: pd.DataFrame,
    ) -> pd.DataFrame:
        columns_set = set(df.columns)
        difference_column = self._find_difference_column(columns_set)
        flat_rows: list[dict[str, Any]] = []

        for idx in range(len(df) - 1):
            voucher_row = df.iloc[idx]
            value_row = df.iloc[idx + 1]

            if should_skip_audit_row(
                voucher_row,
                columns_set,
                normalize_empty=self.normalize_empty_value,
                check_missing_voucher=False,
            ):
                continue

            if not self._is_voucher_row(voucher_row, columns_set):
                continue

            if should_skip_audit_row(
                value_row,
                columns_set,
                normalize_empty=self.normalize_empty_value,
                check_missing_voucher=False,
            ):
                continue

            manual_raw = value_row.get("manual_gross_weight")
            auto_raw = value_row.get("auto_gross_weight")
            manual_dec = parse_weight_decimal(manual_raw)
            auto_dec = parse_weight_decimal(auto_raw)

            if manual_dec is None or auto_dec is None:
                continue

            difference_raw = (
                value_row.get(difference_column)
                if difference_column is not None
                else None
            )
            difference = (
                difference_raw
                if self.normalize_empty_value(difference_raw) is not None
                else manual_dec - auto_dec
            )

            voucher_no = self._voucher_value(voucher_row, columns_set)

            # Include all columns from both rows (value row preferred for overlaps)
            row_dict = {}
            for col in df.columns:
                row_dict[col] = value_row.get(col) if value_row.get(col) is not None else voucher_row.get(col)
            
            row_dict.update({
                "voucher_no": voucher_no,
                "manual_gross_weight": manual_raw,
                "auto_gross_weight": auto_raw,
                "difference": difference,
                "value_row_index": idx + 3,
            })
            
            flat_rows.append(row_dict)

        # Get all columns from df plus our calculated columns
        all_cols = list(df.columns) + [
            "voucher_no",
            "manual_gross_weight",
            "auto_gross_weight",
            "difference",
            "value_row_index",
        ]
        # Remove duplicates while preserving order
        seen = set()
        final_cols = []
        for col in all_cols:
            if col not in seen:
                final_cols.append(col)
                seen.add(col)

        return pd.DataFrame(
            flat_rows if flat_rows else self._normal_rows_to_flat(df, columns_set),
            columns=final_cols,
        )

    def _normal_rows_to_flat(
        self,
        df: pd.DataFrame,
        columns_set: set[str],
    ) -> list[dict[str, Any]]:
        flat_rows: list[dict[str, Any]] = []
        difference_column = self._find_difference_column(columns_set)

        for idx, row in df.iterrows():
            if should_skip_audit_row(
                row,
                columns_set,
                normalize_empty=self.normalize_empty_value,
                check_missing_voucher=False,
            ):
                continue

            manual_raw = row.get("manual_gross_weight")
            auto_raw = row.get("auto_gross_weight")
            manual_dec = parse_weight_decimal(manual_raw)
            auto_dec = parse_weight_decimal(auto_raw)

            if manual_dec is None or auto_dec is None:
                continue

            difference_raw = (
                row.get(difference_column)
                if difference_column is not None
                else None
            )
            difference = (
                difference_raw
                if self.normalize_empty_value(difference_raw) is not None
                else manual_dec - auto_dec
            )

            # Include all columns from the original row
            row_dict = {}
            for col in df.columns:
                row_dict[col] = row.get(col)
            
            row_dict.update({
                "voucher_no": self._voucher_value(row, columns_set),
                "manual_gross_weight": manual_raw,
                "auto_gross_weight": auto_raw,
                "difference": difference,
                "value_row_index": int(idx) + 2,
            })
            
            flat_rows.append(row_dict)
        return flat_rows

    def _find_difference_column(self, columns_set: set[str]) -> str | None:
        for column in (
            "difference",
            "diff",
            "difference_in_gross_wt",
            "difference_in_gross_wt_",
            "weight_difference",
            "gross_difference",
        ):
            if column in columns_set:
                return column

        return None

    def _voucher_value(
        self,
        row: pd.Series,
        columns_set: set[str],
    ) -> str | None:
        if "voucher_no" in columns_set:
            voucher = self.normalize_empty_value(row.get("voucher_no"))
            if voucher is not None:
                return voucher

        first_cell = row.iloc[0] if len(row) else None
        return self.normalize_empty_value(first_cell)

    def _is_voucher_row(
        self,
        row: pd.Series,
        columns_set: set[str],
    ) -> bool:
        voucher = self._voucher_value(row, columns_set)
        if voucher is None:
            return False

        voucher_lower = voucher.lower()
        if "total" in voucher_lower or "audit" in voucher_lower:
            return False

        if self._has_weight_values(row):
            return False

        return True

    def _has_weight_values(self, row: pd.Series) -> bool:
        return (
            parse_weight_decimal(row.get("manual_gross_weight")) is not None
            or parse_weight_decimal(row.get("auto_gross_weight")) is not None
        )

    def _is_valid_value_row(self, row: pd.Series) -> bool:
        return (
            parse_weight_decimal(row.get("manual_gross_weight")) is not None
            and parse_weight_decimal(row.get("auto_gross_weight")) is not None
        )

    def _canonical_gross_columns(
        self,
        df: pd.DataFrame,
    ) -> pd.DataFrame:
        renames: dict[str, str] = {}

        for col in df.columns:
            col_lower = str(col).strip().lower()

            if col_lower in (
                "manual_gross_wt",
                "manual gross wt.",
                "manual gross wt",
            ):
                renames[col] = "manual_gross_weight"

            elif col_lower in (
                "auto_gross_wt",
                "auto gross wt.",
                "auto gross wt",
            ):
                renames[col] = "auto_gross_weight"

            elif col_lower in (
                "diff",
                "difference",
                "difference_in_gross_wt",
                "difference_in_gross_wt_",
                "difference in gross wt.",
                "difference in gross wt",
                "weight_difference",
                "gross_difference",
            ):
                renames[col] = "difference"

        return df.rename(columns=renames) if renames else df

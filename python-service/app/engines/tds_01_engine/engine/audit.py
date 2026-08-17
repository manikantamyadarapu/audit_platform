"""TDS @ 0.1% audit orchestration."""

from __future__ import annotations

from time import perf_counter
from typing import Any

from app.core.vectorized_validation_engine import VectorizedValidationEngine
from app.engines.tds_01_engine.config.constants import REQUIRED_COLUMNS
from app.engines.tds_01_engine.engine.output import build_tds_01_response
from app.engines.tds_01_engine.engine.tds_calculator import build_tds_report_frames
from app.engines.tds_01_engine.parsers.excel_parser import (
    load_purchase_voucher_workbook,
    validate_required_columns,
)
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError


def _serialize_summary_rows(summary_df: Any) -> list[dict[str, Any]]:
    """Convert the summary DataFrame to API rows while preserving computed TDS values."""
    if summary_df.empty:
        return []

    return [
        {
            'party': row.get('party', ''),
            'purchase_during_year': row.get('purchase_during_year', row.get('purchases_during_year', 0)),
            'tds': row.get('tds', row.get('tds_deductible', '')),
            'purchases_during_year': row.get('purchases_during_year', row.get('purchase_during_year', 0)),
            'tds_deductible': row.get('tds_deductible', row.get('tds', '')),
        }
        for row in summary_df.to_dict(orient='records')
    ]


def _serialize_detailed_rows(detailed_df: Any) -> list[dict[str, Any]]:
    if detailed_df.empty:
        return []
    prepared = detailed_df.copy()
    if '__original_order' in prepared.columns:
        prepared = prepared.sort_values('__original_order', kind='mergesort').reset_index(drop=True)
    for column in ('date', 'voucher_no', 'branch', 'pan'):
        if column in prepared.columns:
            prepared[column] = prepared[column].map(
                lambda v: '' if v is None or (isinstance(v, float) and v != v) else str(v).strip()
            )
    if 'gross_amount' in prepared.columns:
        prepared['gross_amount'] = prepared['gross_amount'].astype(float).round(2)
    return prepared[
        [c for c in ('date', 'voucher_no', 'party', 'gross_amount', 'branch', 'pan') if c in prepared.columns]
    ].to_dict(orient='records')


class Tds01Audit:
    """Supplier-wise TDS @ 0.1% on Purchase Voucher Listing."""

    def __init__(self) -> None:
        self.engine = VectorizedValidationEngine('tds_rate_01')
        self._log = get_logger()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        started = perf_counter()
        self._log.info('TDS @ 0.1%: loading purchase voucher workbook')

        try:
            loaded = load_purchase_voucher_workbook(file_bytes, log=self._log)
        except SheetValidationError:
            raise
        except Exception as exc:
            raise ValueError('Invalid or unreadable Excel file') from exc

        df = loaded.dataframe
        data_columns = self.engine.user_columns(df)
        is_valid, missing = validate_required_columns(set(data_columns))
        if not is_valid:
            found = sorted(c for c in data_columns if str(c).strip())
            header_excel = int(loaded.header_row_index) + 1
            raise SheetValidationError(
                'Purchase Voucher Listing: missing required columns after header detection: '
                f"{', '.join(missing)}",
                code='MISSING_REQUIRED_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=found,
                headerRowExcel=header_excel,
                expectedColumns=sorted(REQUIRED_COLUMNS),
                hints=[
                    'Required columns: Date, Voucher No, Party, Gross Amount.',
                    'Optional columns: Branch, PAN.',
                    'Example: "Gross Amount" → gross_amount, "Party Name" → party.',
                ],
            )

        self._log.info('TDS @ 0.1%: validating and grouping by party')
        rows = df.to_dicts()
        frame, summary_df, detailed_df, metrics = build_tds_report_frames(rows)

        summary_rows = _serialize_summary_rows(summary_df)

        detailed_rows = _serialize_detailed_rows(detailed_df)
        eligible_parties = set(summary_df['party'].tolist()) if not summary_df.empty else set()
        non_eligible_df = (
            frame[~frame['party'].isin(eligible_parties)].copy()
            if not frame.empty
            else frame
        )
        non_eligible_rows = _serialize_detailed_rows(non_eligible_df)

        response = build_tds_01_response(
            detailed_rows=detailed_rows,
            summary_rows=summary_rows,
            metrics=metrics,
        )
        response['nonEligibleDetailedRecords'] = non_eligible_rows

        elapsed_ms = (perf_counter() - started) * 1000
        if metrics.get('mixedParties'):
            self._log.warning(
                'TDS @ 0.1% mixed B2B/B2C parties skipped for TDS calculation: %s',
                ', '.join(metrics.get('mixedPartyNames') or []),
            )
        self._log.info(
            'TDS @ 0.1% completed: records=%s eligible=%s tds=%s elapsed_ms=%.1f',
            metrics.get('totalRecords'),
            metrics.get('eligibleSuppliers'),
            metrics.get('totalTdsDeductible'),
            elapsed_ms,
        )
        return response

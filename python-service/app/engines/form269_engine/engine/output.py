"""Response builder for Form 269 combined audit."""

from __future__ import annotations

from typing import Any

from app.engines.form269_engine.config.constants import EXPORT_COLUMNS, EXPORT_HEADER_MAP


def build_form269_response(
    *,
    records_269ss: list[dict[str, Any]],
    records_269st: list[dict[str, Any]],
    file_summaries: list[dict[str, Any]],
    total_input_files: int,
    total_transaction_rows: int,
    processing_ms: float,
) -> dict[str, Any]:
    return {
        'success': True,
        'totalInputFiles': total_input_files,
        'totalTransactionRows': total_transaction_rows,
        'totalRows269SS': len(records_269ss),
        'totalRows269ST': len(records_269st),
        'records269SS': records_269ss,
        'records269ST': records_269st,
        'fileSummaries': file_summaries,
        'exportColumns': list(EXPORT_COLUMNS),
        'columnDisplayHeaders': dict(EXPORT_HEADER_MAP),
        'processingTimeMs': round(processing_ms, 2),
    }

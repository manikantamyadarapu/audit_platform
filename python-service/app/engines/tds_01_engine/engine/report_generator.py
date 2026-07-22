"""Excel report generation for TDS @ 0.1%."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.engines.tds_01_engine.config.constants import (
    DETAILED_COLUMNS,
    DETAILED_HEADER_MAP,
    EMPTY_SHEET_MESSAGE,
    SHEET_DETAILED,
    SHEET_SUMMARY,
    SUMMARY_COLUMNS,
    SUMMARY_HEADER_MAP,
)
from app.utils.audit_excel_exporter import build_multi_sheet_audit_workbook


def generate_tds_01_workbook(
    *,
    detailed_rows: Sequence[Mapping[str, Any]] | None = None,
    summary_rows: Sequence[Mapping[str, Any]] | None = None,
) -> bytes:
    """Build TDS_0_1_Report.xlsx with Detailed + Summary sheets."""
    return build_multi_sheet_audit_workbook(
        {
            SHEET_DETAILED: list(detailed_rows or []),
            SHEET_SUMMARY: list(summary_rows or []),
        },
        per_sheet={
            SHEET_DETAILED: {
                'columns': list(DETAILED_COLUMNS),
                'header_map': dict(DETAILED_HEADER_MAP),
            },
            SHEET_SUMMARY: {
                'columns': list(SUMMARY_COLUMNS),
                'header_map': dict(SUMMARY_HEADER_MAP),
            },
        },
        empty_message=EMPTY_SHEET_MESSAGE,
    )

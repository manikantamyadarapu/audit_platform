from typing import Any

from app.sales_engine.engine.sales_audit_output import (
    SALES_AUDIT_OUTPUT_COLUMNS,
    sales_records_for_export,
)
from app.utils.audit_reporter import build_audit_excel_report

PAN_EXPORT_COLUMNS = [
    'rowNumber',
    'date',
    'voucherNo',
    'party',
    'totalValue',
    'pan',
    'pan1',
    'addProof',
    'addProof2',
    'issues',
    'messages',
]


GROSS_EXPORT_COLUMNS = [
    'rowNumber',
    'voucherNo',
    'manualGrossWeight',
    'autoGrossWeight',
    'difference',
    'issues',
]

GROSS_EXPORT_HEADER_MAP = {
    'rowNumber': 'SNo',
    'voucherNo': 'Voucher No',
    'manualGrossWeight': 'Manual Gross Wt.',
    'autoGrossWeight': 'Auto Gross Wt.',
    'difference': 'Difference in Gross Wt.',
    'issues': 'Issue',
}

SALES_EXPORT_COLUMNS = list(SALES_AUDIT_OUTPUT_COLUMNS)


def export_invalid_pan_records(
    records: list[dict[str, Any]],
    *,
    summary: dict[str, Any] | None = None,
    processing_statistics: dict[str, Any] | None = None,
    execution_timing: dict[str, Any] | None = None,
) -> bytes:
    return build_audit_excel_report(
        report_title='PAN Audit Report',
        invalid_sheet_name='Invalid PAN Rows',
        source_processor='pan',
        records=records,
        export_columns=PAN_EXPORT_COLUMNS,
        summary=summary,
        processing_statistics=processing_statistics,
        execution_timing=execution_timing,
    )


def export_invalid_gross_weight_records(
    records: list[dict[str, Any]],
    *,
    summary: dict[str, Any] | None = None,
    processing_statistics: dict[str, Any] | None = None,
    execution_timing: dict[str, Any] | None = None,
) -> bytes:
    return build_audit_excel_report(
        report_title='Gross Weight Audit Report',
        invalid_sheet_name='Invalid Gross Weight Rows',
        source_processor='gross_weight',
        records=records,
        export_columns=GROSS_EXPORT_COLUMNS,
        header_map=GROSS_EXPORT_HEADER_MAP,
        summary=summary,
        processing_statistics=processing_statistics,
        execution_timing=execution_timing,
    )


def export_invalid_sales_records(
    records: list[dict[str, Any]],
    *,
    summary: dict[str, Any] | None = None,
    processing_statistics: dict[str, Any] | None = None,
    execution_timing: dict[str, Any] | None = None,
) -> bytes:
    return build_audit_excel_report(
        report_title='Sales Audit Report',
        invalid_sheet_name='Invalid Sales Rows',
        source_processor='sales',
        records=sales_records_for_export(records),
        export_columns=SALES_EXPORT_COLUMNS,
        summary=summary,
        processing_statistics=processing_statistics,
        execution_timing=execution_timing,
    )

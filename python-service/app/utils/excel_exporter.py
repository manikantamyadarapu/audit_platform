from typing import Any

import pandas as pd
from io import BytesIO

from app.engines.sales_engine.engine.sales_audit_output import (
    SALES_AUDIT_OUTPUT_COLUMNS,
    sales_records_for_export,
)
from app.engines.sales_return_engine.engine.exception_report import (
    SALES_RETURN_EXCEPTION_COLUMNS,
    SALES_RETURN_EXCEPTION_HEADER_MAP,
)
from app.utils.audit_excel_exporter import build_multi_sheet_audit_workbook
from app.utils.audit_reporter import build_audit_excel_report

CASH_LEDGER_RULE_SHEETS = (
    ('Negative Cash', 'NEGATIVE_CASH_BALANCE'),
    ('Cash Payments >= ₹10,000', 'CASH_PAYMENT_GT_10000'),
    ('Cash Receipts >= ₹2,00,000', 'CASH_RECEIPT_GT_200000'),
)

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
    'messages',
]

GROSS_EXPORT_HEADER_MAP = {
    'rowNumber': 'Row Number',
    'voucherNo': 'Voucher No',
    'manualGrossWeight': 'Manual Gross Weight',
    'autoGrossWeight': 'Auto Gross Weight',
    'difference': 'Difference',
    'messages': 'Message',
}

SALES_EXPORT_COLUMNS = list(SALES_AUDIT_OUTPUT_COLUMNS)

SALES_RETURN_RATE_COMPARISON_COLUMNS = [
    'product',
    'returnTransactionCount',
    'salesTotalGrossAmount',
    'salesTotalQuantity',
    'salesAverageRate',
    'returnTotalGrossAmount',
    'returnTotalQuantity',
    'returnAverageRate',
    'difference',
    'Message',
]

SALES_RETURN_RATE_COMPARISON_HEADER_MAP = {
    'product': 'Product',
    'returnTransactionCount': 'Return Transaction Count',
    'salesTotalGrossAmount': 'Sales Total Gross Amount',
    'salesTotalQuantity': 'Sales Total Quantity',
    'salesAverageRate': 'Sales Average Rate',
    'returnTotalGrossAmount': 'Sales Return Total Gross Amount',
    'returnTotalQuantity': 'Sales Return Total Quantity',
    'returnAverageRate': 'Sales Return Average Rate',
    'difference': 'Difference',
    'Message': 'Message',
}

CASH_LEDGER_EXPORT_COLUMNS = [
    'rowNumber',
    'date',
    'voucher_no',
    'branch',
    'contra_account',
    'debit',
    'credit',
    'balance',
    'Message',
]

CASH_LEDGER_EXPORT_HEADER_MAP = {
    'rowNumber': 'Row No',
    'date': 'Date',
    'voucher_no': 'Voucher No',
    'branch': 'Branch',
    'contra_account': 'Contra Account',
    'debit': 'Debit',
    'credit': 'Credit',
    'balance': 'Balance',
    'Message': 'Message',
}

NEGATIVE_BANK_EXPORT_COLUMNS = [
    'rowNumber',
    'date',
    'voucher_no',
    'branch',
    'contra_account',
    'debit',
    'credit',
    'balance',
    'tillDate',
    'Message',
]

NEGATIVE_BANK_EXPORT_HEADER_MAP = {
    'rowNumber': 'Row No',
    'date': 'Date',
    'voucher_no': 'Voucher No',
    'branch': 'Branch',
    'contra_account': 'Contra Account',
    'debit': 'Debit',
    'credit': 'Credit',
    'balance': 'Balance',
    'tillDate': 'Till Date',
    'Message': 'Message',
}

NEGATIVE_BANK_NO_REPORT_MESSAGE = 'No report for this audit rule.'


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
    export_columns: list[str] | None = None,
    summary: dict[str, Any] | None = None,
    processing_statistics: dict[str, Any] | None = None,
    execution_timing: dict[str, Any] | None = None,
) -> bytes:
    """Single-sheet export: exception table rows (original columns + Message)."""
    del summary, processing_statistics, execution_timing
    if not records:
        raise ValueError('No exception records to export')
    sample = records[0]
    if 'Message' in sample or export_columns:
        resolved_columns = _resolve_sales_return_export_columns(records, export_columns)
        return _build_single_sheet_excel(
            records,
            resolved_columns,
            sheet_name='Invalid Sales Rows',
        )
    normalized = sales_records_for_export(records)
    return _build_single_sheet_excel(
        normalized,
        list(SALES_EXPORT_COLUMNS),
        sheet_name='Invalid Sales Rows',
    )


def export_sales_return_exceptions(
    records: list[dict[str, Any]],
    *,
    export_columns: list[str] | None = None,
    header_map: dict[str, str] | None = None,
) -> bytes:
    """Single-sheet export: exception table rows only (no summary/metrics sheets)."""
    del header_map  # Records already use display column headers.
    if not records:
        raise ValueError('No exception records to export')
    resolved_columns = _resolve_sales_return_export_columns(records, export_columns)
    return _build_single_sheet_excel(
        records,
        resolved_columns,
        sheet_name='Final Exception Report',
    )


def _resolve_sales_return_export_columns(
    records: list[dict[str, Any]],
    export_columns: list[str] | None,
) -> list[str]:
    record_keys = list(records[0].keys())
    if not export_columns:
        return _message_column_last(record_keys)

    ordered = [column for column in export_columns if column in record_keys]
    if not ordered:
        return _message_column_last(record_keys)
    return _message_column_last(ordered)


def _message_column_last(columns: list[str]) -> list[str]:
    message = 'Message'
    without = [column for column in columns if column != message]
    if message in columns:
        without.append(message)
    return without


def _build_single_sheet_excel(
    records: list[dict[str, Any]],
    export_columns: list[str],
    *,
    sheet_name: str,
) -> bytes:
    import pandas as pd
    from io import BytesIO

    dataframe = pd.DataFrame(records).copy()
    for column in export_columns:
        if column not in dataframe.columns:
            dataframe[column] = ''
    dataframe = dataframe[export_columns]

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        dataframe.to_excel(writer, index=False, sheet_name=sheet_name)
        workbook = writer.book
        worksheet = writer.sheets[sheet_name]
        header_format = workbook.add_format(
            {
                'bold': True,
                'font_color': 'white',
                'bg_color': '#1F4E78',
                'border': 1,
            }
        )
        worksheet.freeze_panes(1, 0)
        worksheet.autofilter(0, 0, max(len(dataframe), 1), max(len(dataframe.columns) - 1, 0))
        for idx, column in enumerate(dataframe.columns):
            width = max(len(str(column)), _max_value_length(dataframe[column])) + 2
            worksheet.set_column(idx, idx, min(width, 60))
            worksheet.write(0, idx, column, header_format)

    output.seek(0)
    return output.getvalue()


def _max_value_length(series) -> int:
    if series.empty:
        return 0
    return max(len(str(value)) for value in series.fillna('').tolist())


def export_sales_return_rate_comparison(records: list[dict[str, Any]]) -> bytes:
    if not records:
        raise ValueError('No rate comparison records to export')

    rows: list[dict[str, Any]] = []
    for record in records:
        issues = record.get('issues') or []
        messages = record.get('messages') or []
        issue_text = '; '.join(str(i) for i in issues) if isinstance(issues, list) else str(issues or '')
        message_text = '; '.join(str(m) for m in messages) if isinstance(messages, list) else str(messages or '')
        message_column = record.get('Message')
        if message_column in (None, ''):
            message_column = message_text or issue_text

        rows.append(
            {
                'product': record.get('product', ''),
                'returnTransactionCount': record.get('returnTransactionCount', ''),
                'salesTotalGrossAmount': record.get('salesTotalGrossAmount', ''),
                'salesTotalQuantity': record.get('salesTotalQuantity', ''),
                'salesAverageRate': record.get('salesAverageRate', ''),
                'returnTotalGrossAmount': record.get('returnTotalGrossAmount', ''),
                'returnTotalQuantity': record.get('returnTotalQuantity', ''),
                'returnAverageRate': record.get('returnAverageRate', ''),
                'difference': record.get('difference', ''),
                'Message': message_column,
            }
        )

    dataframe = pd.DataFrame(rows)
    dataframe = dataframe.rename(columns=SALES_RETURN_RATE_COMPARISON_HEADER_MAP)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        sheet_name = 'Product Average Comparison'
        dataframe.to_excel(writer, index=False, sheet_name=sheet_name)
        workbook = writer.book
        header_format = workbook.add_format(
            {'bold': True, 'font_color': 'white', 'bg_color': '#1F4E78', 'border': 1}
        )
        worksheet = writer.sheets[sheet_name]
        worksheet.freeze_panes(1, 0)
        for idx, column in enumerate(dataframe.columns):
            width = max(len(str(column)), _max_value_length(dataframe[column])) + 2
            worksheet.set_column(idx, idx, min(width, 60))
            worksheet.write(0, idx, column, header_format)

    output.seek(0)
    return output.getvalue()


def _cash_ledger_rows_for_issue(
    records: list[dict[str, Any]], issue_code: str
) -> list[dict[str, Any]]:
    matched: list[dict[str, Any]] = []
    for record in records:
        issues = record.get('issues') or []
        if isinstance(issues, list) and issue_code in issues:
            matched.append(record)
            continue
        if record.get('issueCode') == issue_code:
            matched.append(record)
    return matched


def export_cash_ledger_total_error_report(records: list[dict[str, Any]] | None = None) -> bytes:
    """
    One workbook with a worksheet per Cash Ledger audit rule (widget name).

    Empty rules still get a sheet with a placeholder message.
    """
    source = list(records or [])
    sheets: dict[str, list[dict[str, Any]]] = {
        sheet_name: _cash_ledger_rows_for_issue(source, issue_code)
        for sheet_name, issue_code in CASH_LEDGER_RULE_SHEETS
    }
    return build_multi_sheet_audit_workbook(
        sheets,
        columns=CASH_LEDGER_EXPORT_COLUMNS,
        header_map=CASH_LEDGER_EXPORT_HEADER_MAP,
    )


def export_cash_ledger_records(
    records: list[dict[str, Any]],
    *,
    summary: dict[str, Any] | None = None,
    processing_statistics: dict[str, Any] | None = None,
    execution_timing: dict[str, Any] | None = None,
) -> bytes:
    return build_audit_excel_report(
        report_title='Cash Ledger Audit Report',
        invalid_sheet_name='Cash Ledger Issues',
        source_processor='cash_ledger',
        records=records,
        export_columns=CASH_LEDGER_EXPORT_COLUMNS,
        header_map=CASH_LEDGER_EXPORT_HEADER_MAP,
        summary=summary,
        processing_statistics=processing_statistics,
        execution_timing=execution_timing,
    )


def export_negative_bank_records(
    records: list[dict[str, Any]],
    *,
    summary: dict[str, Any] | None = None,
    processing_statistics: dict[str, Any] | None = None,
    execution_timing: dict[str, Any] | None = None,
) -> bytes:
    if not records:
        from openpyxl import Workbook

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = 'Negative Bank'
        sheet.append([NEGATIVE_BANK_NO_REPORT_MESSAGE])
        output = BytesIO()
        workbook.save(output)
        output.seek(0)
        return output.getvalue()

    return build_audit_excel_report(
        report_title='Negative Bank Audit Report',
        invalid_sheet_name='Negative Bank',
        source_processor='negative_bank',
        records=records,
        export_columns=NEGATIVE_BANK_EXPORT_COLUMNS,
        header_map=NEGATIVE_BANK_EXPORT_HEADER_MAP,
        summary=summary,
        processing_statistics=processing_statistics,
        execution_timing=execution_timing,
    )

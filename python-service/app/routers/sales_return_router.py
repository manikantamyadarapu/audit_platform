"""Sales return engine HTTP routes."""

import json
import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse

from app.engines.sales_return_engine.engine.processor import SalesReturnAuditProcessor
from app.schemas.process_schemas import (
    SalesReturnExceptionExportRequest,
    SalesReturnRateComparisonExportRequest,
)
from app.utils.excel_exporter import (
    export_sales_return_exceptions,
    export_sales_return_rate_comparison,
)
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['sales-return'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['sales-return'])


@router.post('/sales-return/validate')
@gateway_router.post('/sales-return/validate')
async def process_sales_return(
    sales_return_file: UploadFile = File(..., description='Sales return audit Excel file'),
    sales_averages: str = Form(default='[]', description='Stored sales audit product averages JSON'),
) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Sales return audit processing request received')
    return_bytes = await sales_return_file.read()
    if not return_bytes:
        raise ValueError('Sales return audit file is empty')
    try:
        parsed_averages = json.loads(sales_averages or '[]')
    except json.JSONDecodeError as exc:
        raise ValueError('sales_averages must be valid JSON') from exc
    if not isinstance(parsed_averages, list):
        raise ValueError('sales_averages must be a JSON array')
    processor = SalesReturnAuditProcessor()
    response = processor.process(return_bytes, parsed_averages)
    log.info('Sales return audit processing complete')
    return response


@router.post('/sales-return/export-exceptions')
@gateway_router.post('/sales-return/export-exceptions')
async def export_sales_return_exception_rows(
    payload: SalesReturnExceptionExportRequest,
) -> StreamingResponse:
    from app.engines.sales_return_engine.engine.exception_report import (
        build_consolidated_exception_records,
        build_export_metadata,
    )

    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Sales return exception export request received')
    if payload.records:
        records = payload.records
    elif payload.validationIssues is not None or payload.comparisonIssues is not None:
        records = build_consolidated_exception_records(
            payload.validationIssues or [],
            payload.comparisonIssues or [],
            source_columns=payload.exportColumns or [],
            column_display_headers=payload.columnDisplayHeaders or {},
        )
    else:
        raise ValueError('Request body must include "records" or validation/comparison issue arrays')

    export_columns = None
    if payload.exportColumns and payload.columnDisplayHeaders:
        export_columns, _header_map = build_export_metadata(
            payload.exportColumns,
            payload.columnDisplayHeaders,
        )
    elif payload.exportColumns and records:
        sample_keys = set(records[0].keys())
        if payload.exportColumns[0] in sample_keys:
            export_columns = list(payload.exportColumns)
        else:
            export_columns, _header_map = build_export_metadata(
                payload.exportColumns,
                payload.columnDisplayHeaders or {},
            )
    elif records:
        export_columns = list(records[0].keys())

    excel_bytes = export_sales_return_exceptions(
        records,
        export_columns=export_columns,
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'sales-return-audit-report-{timestamp}.xlsx'
    log.info('Sales return exception export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.post('/sales-return/export-rate-comparison')
@gateway_router.post('/sales-return/export-rate-comparison')
async def export_sales_return_rate_comparison_rows(
    payload: SalesReturnRateComparisonExportRequest,
) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Sales return rate comparison export request received')
    excel_bytes = export_sales_return_rate_comparison(payload.records)
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'sales-return-rate-comparison-{timestamp}.xlsx'
    log.info('Sales return rate comparison export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

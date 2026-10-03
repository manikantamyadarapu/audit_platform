"""Purchase return engine HTTP routes."""

import json
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.engines.purchase_return_engine.engine.processor import PurchaseReturnAuditProcessor
from app.schemas.process_schemas import (
    SalesReturnExceptionExportRequest,
    SalesReturnRateComparisonExportRequest,
)
from app.utils.async_work import run_sync
from app.utils.excel_exporter import (
    export_sales_return_exceptions,
    export_sales_return_rate_comparison,
)
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id

router = APIRouter(prefix='/api/process', tags=['purchase-return'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['purchase-return'])


@router.post('/purchase-return/validate')
@gateway_router.post('/purchase-return/validate')
async def process_purchase_return(
    request: Request,
    purchase_return_file: UploadFile = File(..., description='Purchase return audit Excel file'),
    purchase_averages: str = Form(
        default='[]',
        description='Stored purchase audit product averages JSON',
    ),
) -> dict:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Purchase return audit processing request received')
    return_bytes = await purchase_return_file.read()
    if not return_bytes:
        raise ValueError('Purchase return audit file is empty')
    try:
        parsed_averages = json.loads(purchase_averages or '[]')
    except json.JSONDecodeError as exc:
        raise ValueError('purchase_averages must be valid JSON') from exc
    if not isinstance(parsed_averages, list):
        raise ValueError('purchase_averages must be a JSON array')
    processor = PurchaseReturnAuditProcessor()
    response = await run_sync(processor.process, return_bytes, parsed_averages)
    log.info('Purchase return audit processing complete')
    return response


@router.post('/purchase-return/export-exceptions')
@gateway_router.post('/purchase-return/export-exceptions')
async def export_purchase_return_exception_rows(
    request: Request,
    payload: SalesReturnExceptionExportRequest,
) -> StreamingResponse:
    from app.engines.purchase_return_engine.engine.exception_report import (
        build_consolidated_exception_records,
        build_export_metadata,
    )

    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Purchase return exception export request received')
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

    excel_bytes = await run_sync(
        export_sales_return_exceptions,
        records,
        export_columns=export_columns,
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'purchase-return-audit-report-{timestamp}.xlsx'
    log.info('Purchase return exception export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )


@router.post('/purchase-return/export-rate-comparison')
@gateway_router.post('/purchase-return/export-rate-comparison')
async def export_purchase_return_rate_comparison_rows(
    request: Request,
    payload: SalesReturnRateComparisonExportRequest,
) -> StreamingResponse:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Purchase return rate comparison export request received')
    excel_bytes = await run_sync(export_sales_return_rate_comparison, payload.records)
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'purchase-return-rate-comparison-{timestamp}.xlsx'
    log.info('Purchase return rate comparison export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )

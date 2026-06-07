import json
import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.processors.sales_return_audit_processor import SalesReturnAuditProcessor
from app.services.processing_service import ProcessingService
from app.utils.excel_exporter import (
    export_invalid_gross_weight_records,
    export_invalid_pan_records,
    export_invalid_sales_records,
    export_sales_return_exceptions,
    export_sales_return_rate_comparison,
)
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['processing'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['processing'])
service = ProcessingService()


class PanInvalidRowsExportRequest(BaseModel):
    records: list[dict[str, Any]]
    summary: dict[str, Any] | None = None
    processingStatistics: dict[str, Any] | None = None
    executionTiming: dict[str, Any] | None = None


class InvalidRowsExportRequest(BaseModel):
    records: list[dict[str, Any]]
    summary: dict[str, Any] | None = None
    processingStatistics: dict[str, Any] | None = None
    executionTiming: dict[str, Any] | None = None


@router.post('/pan')
@gateway_router.post('/pan/validate')
async def process_pan(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('PAN processing request received')
    response = await service.process('pan', file)
    log.info('PAN processing complete')
    return response


@router.post('/pan/export-invalid')
@gateway_router.post('/pan/export-invalid')
async def export_pan_invalid_rows(payload: PanInvalidRowsExportRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('PAN invalid rows export request received')
    try:
        record_count = len(payload.records or [])
    except Exception:
        record_count = None
    log.info(f'PAN invalid rows export payload size: {record_count} records')

    excel_bytes = export_invalid_pan_records(
        payload.records,
        summary=payload.summary,
        processing_statistics=payload.processingStatistics,
        execution_timing=payload.executionTiming,
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'pan-invalid-rows-{timestamp}.xlsx'

    log.info('PAN invalid rows export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.post('/gst')
@gateway_router.post('/gst/validate')
async def process_gst(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('GST processing request received')
    response = await service.process('gst', file)
    log.info('GST processing complete')
    return response


@router.post('/gross-weight/export-invalid')
@gateway_router.post('/gross-weight/export-invalid')
async def export_gross_weight_invalid_rows(payload: InvalidRowsExportRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Gross weight invalid rows export request received')
    excel_bytes = export_invalid_gross_weight_records(
        payload.records,
        summary=payload.summary,
        processing_statistics=payload.processingStatistics,
        execution_timing=payload.executionTiming,
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'gross-weight-invalid-rows-{timestamp}.xlsx'
    log.info('Gross weight invalid rows export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.post('/gross-weight')
@gateway_router.post('/gross-weight/validate')
async def process_gross_weight(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Gross weight processing request received')
    response = await service.process('gross_weight', file)
    log.info('Gross weight processing complete')
    return response


@router.post('/sales/export-invalid')
@gateway_router.post('/sales/export-invalid')
async def export_sales_invalid_rows(payload: InvalidRowsExportRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Sales invalid rows export request received')
    excel_bytes = export_invalid_sales_records(
        payload.records,
        summary=payload.summary,
        processing_statistics=payload.processingStatistics,
        execution_timing=payload.executionTiming,
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'sales-invalid-rows-{timestamp}.xlsx'
    log.info('Sales invalid rows export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.post('/sales')
@gateway_router.post('/sales/validate')
async def process_sales(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Sales audit processing request received')
    response = await service.process('sales', file)
    log.info('Sales audit processing complete')
    return response


class SalesReturnRateComparisonExportRequest(BaseModel):
    records: list[dict[str, Any]]


class SalesReturnExceptionExportRequest(BaseModel):
    records: list[dict[str, Any]]


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
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Sales return exception export request received')
    excel_bytes = export_sales_return_exceptions(payload.records)
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'sales-return-exceptions-{timestamp}.xlsx'
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

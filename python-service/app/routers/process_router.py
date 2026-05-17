import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.processing_service import ProcessingService
from app.utils.excel_exporter import (
    export_invalid_gross_weight_records,
    export_invalid_pan_records,
    export_invalid_sales_records,
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

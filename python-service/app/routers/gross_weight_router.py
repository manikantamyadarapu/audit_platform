"""Gross weight engine HTTP routes."""

from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.process_schemas import InvalidRowsExportRequest
from app.services.processing_service import ProcessingService
from app.utils.async_work import run_sync
from app.utils.excel_exporter import export_invalid_gross_weight_records
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id

router = APIRouter(prefix='/api/process', tags=['gross-weight'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['gross-weight'])
service = ProcessingService()


@router.post('/gross-weight')
@gateway_router.post('/gross-weight/validate')
async def process_gross_weight(request: Request, file: UploadFile = File(...)) -> dict:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Gross weight processing request received')
    response = await service.process('gross_weight', file)
    log.info('Gross weight processing complete')
    return response


@router.post('/gross-weight/export-invalid')
@gateway_router.post('/gross-weight/export-invalid')
async def export_gross_weight_invalid_rows(
    request: Request,
    payload: InvalidRowsExportRequest,
) -> StreamingResponse:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Gross weight invalid rows export request received')
    excel_bytes = await run_sync(
        export_invalid_gross_weight_records,
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
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )

"""PAN engine HTTP routes."""

from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.process_schemas import PanInvalidRowsExportRequest
from app.services.processing_service import ProcessingService
from app.utils.async_work import run_sync
from app.utils.excel_exporter import export_invalid_pan_records
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id

router = APIRouter(prefix='/api/process', tags=['pan'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['pan'])
service = ProcessingService()


@router.post('/pan')
@gateway_router.post('/pan/validate')
async def process_pan(request: Request, file: UploadFile = File(...)) -> dict:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('PAN processing request received')
    response = await service.process('pan', file)
    log.info('PAN processing complete')
    return response


@router.post('/pan/export-invalid')
@gateway_router.post('/pan/export-invalid')
async def export_pan_invalid_rows(
    request: Request,
    payload: PanInvalidRowsExportRequest,
) -> StreamingResponse:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('PAN invalid rows export request received')
    try:
        record_count = len(payload.records or [])
    except Exception:
        record_count = None
    log.info(f'PAN invalid rows export payload size: {record_count} records')

    excel_bytes = await run_sync(
        export_invalid_pan_records,
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
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )

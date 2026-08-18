"""PAN engine HTTP routes."""

import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.process_schemas import PanInvalidRowsExportRequest
from app.services.processing_service import ProcessingService
from app.utils.excel_exporter import export_invalid_pan_records
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['pan'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['pan'])
service = ProcessingService()


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

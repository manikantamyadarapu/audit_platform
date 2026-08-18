"""Negative bank engine HTTP routes."""

import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.process_schemas import InvalidRowsExportRequest
from app.services.processing_service import ProcessingService
from app.utils.excel_exporter import export_negative_bank_records
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['negative-bank'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['negative-bank'])
service = ProcessingService()


@router.post('/negative-bank')
@gateway_router.post('/negative-bank/validate')
async def process_negative_bank(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Negative Bank audit processing request received')
    response = await service.process('negative_bank', file)
    log.info('Negative Bank audit processing complete')
    return response


@router.post('/negative-bank/export-invalid')
@gateway_router.post('/negative-bank/export-invalid')
async def export_negative_bank_invalid_rows(payload: InvalidRowsExportRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Negative Bank invalid rows export request received')
    excel_bytes = export_negative_bank_records(
        payload.records,
        summary=payload.summary,
        processing_statistics=payload.processingStatistics,
        execution_timing=payload.executionTiming,
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'negative-bank-invalid-rows-{timestamp}.xlsx'
    log.info('Negative Bank invalid rows export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

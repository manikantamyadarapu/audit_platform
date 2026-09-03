"""Negative bank engine HTTP routes."""

from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.process_schemas import InvalidRowsExportRequest
from app.services.processing_service import ProcessingService
from app.utils.async_work import run_sync
from app.utils.excel_exporter import export_negative_bank_records
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id

router = APIRouter(prefix='/api/process', tags=['negative-bank'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['negative-bank'])
service = ProcessingService()


@router.post('/negative-bank')
@gateway_router.post('/negative-bank/validate')
async def process_negative_bank(request: Request, file: UploadFile = File(...)) -> dict:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Negative Bank audit processing request received')
    response = await service.process('negative_bank', file)
    log.info('Negative Bank audit processing complete')
    return response


@router.post('/negative-bank/export-invalid')
@gateway_router.post('/negative-bank/export-invalid')
async def export_negative_bank_invalid_rows(
    request: Request,
    payload: InvalidRowsExportRequest,
) -> StreamingResponse:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Negative Bank invalid rows export request received')
    excel_bytes = await run_sync(
        export_negative_bank_records,
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
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )

"""Cash ledger engine HTTP routes."""

import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.process_schemas import InvalidRowsExportRequest
from app.services.processing_service import ProcessingService
from app.utils.excel_exporter import export_cash_ledger_records
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['cash-ledger'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['cash-ledger'])
service = ProcessingService()


@router.post('/cash-ledger')
@gateway_router.post('/cash-ledger/validate')
async def process_cash_ledger(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Cash ledger audit processing request received')
    response = await service.process('cash_ledger', file)
    log.info('Cash ledger audit processing complete')
    return response


@router.post('/cash-ledger/export-invalid')
@gateway_router.post('/cash-ledger/export-invalid')
async def export_cash_ledger_invalid_rows(payload: InvalidRowsExportRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Cash ledger invalid rows export request received')
    excel_bytes = export_cash_ledger_records(
        payload.records,
        summary=payload.summary,
        processing_statistics=payload.processingStatistics,
        execution_timing=payload.executionTiming,
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'cash-ledger-invalid-rows-{timestamp}.xlsx'
    log.info('Cash ledger invalid rows export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

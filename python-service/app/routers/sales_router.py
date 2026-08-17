"""Sales ledger engine HTTP routes."""

import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse

from app.schemas.process_schemas import InvalidRowsExportRequest
from app.services.processing_service import ProcessingService
from app.utils.excel_exporter import export_invalid_sales_records
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['sales'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['sales'])
service = ProcessingService()


@router.post('/sales')
@gateway_router.post('/sales/validate')
async def process_sales(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Sales audit processing request received')
    response = await service.process('sales', file)
    log.info('Sales audit processing complete')
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

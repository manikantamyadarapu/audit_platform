import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.processing_service import ProcessingService
from app.utils.excel_exporter import export_invalid_gross_weight_records, export_invalid_pan_records
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['processing'])
service = ProcessingService()


class PanInvalidRowsExportRequest(BaseModel):
    records: list[dict[str, Any]]


class GrossWeightInvalidRowsExportRequest(BaseModel):
    records: list[dict[str, Any]]


@router.post('/pan')
async def process_pan(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('PAN processing request received')
    response = await service.process('pan', file)
    log.info('PAN processing complete')
    return response


@router.post('/pan/export-invalid')
async def export_pan_invalid_rows(payload: PanInvalidRowsExportRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('PAN invalid rows export request received')

    excel_bytes = export_invalid_pan_records(payload.records)
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'pan-invalid-rows-{timestamp}.xlsx'

    log.info('PAN invalid rows export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.post('/gross-weight')
async def process_gross_weight(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Gross weight processing request received')
    response = await service.process('gross_weight', file)
    log.info('Gross weight processing complete')
    return response


@router.post('/gross-weight/export-invalid')
async def export_gross_weight_invalid_rows(payload: GrossWeightInvalidRowsExportRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Gross weight invalid rows export request received')

    excel_bytes = export_invalid_gross_weight_records(payload.records)
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'gross-weight-invalid-rows-{timestamp}.xlsx'

    log.info('Gross weight invalid rows export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

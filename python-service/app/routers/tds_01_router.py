"""TDS @ 0.1% HTTP routes."""

from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.engines.tds_01_engine.config.constants import EXPORT_FILENAME
from app.engines.tds_01_engine.engine.report_generator import generate_tds_01_workbook
from app.services.processing_service import ProcessingService
from app.utils.async_work import run_sync
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id

router = APIRouter(prefix='/api/process', tags=['tds-rate-0.1'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['tds-rate-0.1'])
service = ProcessingService()


class Tds01ExportRequest(BaseModel):
    detailedRecords: list[dict[str, Any]] | None = None
    summaryRecords: list[dict[str, Any]] | None = None


@router.post('/tds-rate-0.1')
@gateway_router.post('/tds-rate-0.1/validate')
async def process_tds_rate_01(request: Request, file: UploadFile = File(...)) -> dict:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('TDS @ 0.1% audit request received')
    response = await service.process('tds_rate_01', file)
    log.info('TDS @ 0.1% audit complete')
    return response


@router.post('/tds-rate-0.1/export')
@gateway_router.post('/tds-rate-0.1/export')
async def export_tds_rate_01(request: Request, payload: Tds01ExportRequest) -> StreamingResponse:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('TDS @ 0.1% export request received')
    excel_bytes = await run_sync(
        generate_tds_01_workbook,
        detailed_rows=payload.detailedRecords,
        summary_rows=payload.summaryRecords,
    )
    log.info('TDS @ 0.1% export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename="{EXPORT_FILENAME}"',
            'x-request-id': request_id,
        },
    )

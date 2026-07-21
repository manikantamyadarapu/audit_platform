"""Purchase ledger engine HTTP routes."""

import uuid

from fastapi import APIRouter, File, UploadFile

from app.services.processing_service import ProcessingService
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['purchase'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['purchase'])
service = ProcessingService()


@router.post('/purchase')
@gateway_router.post('/purchase/validate')
async def process_purchase(file: UploadFile = File(...)) -> dict:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Purchase ledger processing request received')
    response = await service.process('purchase', file)
    log.info('Purchase ledger processing complete')
    return response

"""Purchase ledger engine HTTP routes."""

from fastapi import APIRouter, File, Request, UploadFile

from app.services.processing_service import ProcessingService
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id

router = APIRouter(prefix='/api/process', tags=['purchase'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['purchase'])
service = ProcessingService()


@router.post('/purchase')
@gateway_router.post('/purchase/validate')
async def process_purchase(request: Request, file: UploadFile = File(...)) -> dict:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Purchase ledger processing request received')
    response = await service.process('purchase', file)
    log.info('Purchase ledger processing complete')
    return response

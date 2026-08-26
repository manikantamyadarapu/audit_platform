"""Section 44AB Cash & Bank Audit HTTP routes."""

import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.engines.section44ab_engine.engine.audit import Section44ABAudit
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['section44ab'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['section44ab'])
audit = Section44ABAudit()


@gateway_router.post('/section44ab')
async def process_section44ab(
    cash_files: list[UploadFile] | None = File(None),
    bank_files: list[UploadFile] | None = File(None),
) -> dict[str, Any]:
    """
    Process Section 44AB Cash & Bank Audit.
    
    Accepts multiple Cash files and multiple Bank files.
    Returns a Section 44AB report with aggregated totals.
    """
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    cash_files = cash_files or []
    bank_files = bank_files or []
    log.info('Section 44AB audit processing request received')
    log.info(f'Cash files: {[f.filename for f in cash_files]}')
    log.info(f'Bank files: {[f.filename for f in bank_files]}')

    # Read Cash files
    cash_file_data: list[tuple[str, bytes]] = []
    for file in cash_files:
        file_bytes = await file.read()
        if not file_bytes:
            log.warning(f'Empty Cash file: {file.filename}')
            continue
        cash_file_data.append((file.filename, file_bytes))

    # Read Bank files
    bank_file_data: list[tuple[str, bytes]] = []
    for file in bank_files:
        file_bytes = await file.read()
        if not file_bytes:
            log.warning(f'Empty Bank file: {file.filename}')
            continue
        bank_file_data.append((file.filename, file_bytes))

    if not cash_file_data and not bank_file_data:
        return JSONResponse(
            status_code=400,
            content={
                'success': False,
                'detail': 'At least one Cash or Bank file must be provided',
                'requestId': request_id,
            },
        )

    try:
        response = audit.process(cash_file_data, bank_file_data)
        response['requestId'] = request_id
        log.info('Section 44AB audit processing complete')
        return response
    except Exception as exc:
        log.error(f'Section 44AB processing failed: {exc}')
        return JSONResponse(
            status_code=500,
            content={
                'success': False,
                'detail': str(exc),
                'requestId': request_id,
            },
        )

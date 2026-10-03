"""Section 44AB Cash & Bank Audit HTTP routes."""

from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse

from app.engines.section44ab_engine.engine.audit import Section44ABAudit
from app.utils.async_work import run_sync
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id
from app.utils.safe_errors import internal_error_body

router = APIRouter(prefix='/api/process', tags=['section44ab'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['section44ab'])
audit = Section44ABAudit()


async def _process_section44ab(
    request: Request,
    cash_files: list[UploadFile] | None,
    bank_files: list[UploadFile] | None,
) -> dict[str, Any]:
    """
    Process Section 44AB Cash & Bank Audit.

    Accepts multiple Cash files and multiple Bank files.
    Returns a Section 44AB report with aggregated totals.
    """
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    cash_files = cash_files or []
    bank_files = bank_files or []
    log.info('Section 44AB audit processing request received')
    log.info(f'Cash files: {[f.filename for f in cash_files]}')
    log.info(f'Bank files: {[f.filename for f in bank_files]}')

    cash_file_data: list[tuple[str, bytes]] = []
    for file in cash_files:
        file_bytes = await file.read()
        if not file_bytes:
            log.warning(f'Empty Cash file: {file.filename}')
            continue
        cash_file_data.append((file.filename or 'cash.xlsx', file_bytes))

    bank_file_data: list[tuple[str, bytes]] = []
    for file in bank_files:
        file_bytes = await file.read()
        if not file_bytes:
            log.warning(f'Empty Bank file: {file.filename}')
            continue
        bank_file_data.append((file.filename or 'bank.xlsx', file_bytes))

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
        response = await run_sync(audit.process, cash_file_data, bank_file_data)
        response['requestId'] = request_id
        log.info('Section 44AB audit processing complete')
        return response
    except Exception as exc:
        log.exception('Section 44AB processing failed: {}', exc)
        return JSONResponse(
            status_code=500,
            content=internal_error_body(request_id=request_id),
        )


@router.post('/section44ab')
@gateway_router.post('/section44ab')
async def process_section44ab(
    request: Request,
    cash_files: list[UploadFile] | None = File(None),
    bank_files: list[UploadFile] | None = File(None),
) -> dict[str, Any]:
    return await _process_section44ab(request, cash_files, bank_files)

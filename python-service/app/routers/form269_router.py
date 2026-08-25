"""Form 269SS / 269ST combined HTTP routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.engines.form269_engine.engine.audit import Form269Audit
from app.utils.logger import get_logger

router = APIRouter(prefix='/api/process', tags=['form-269'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['form-269'])
audit = Form269Audit()

_LEDGER_EXTENSIONS = ('.xlsx', '.xlsm', '.xls')


def _is_ledger_filename(name: str | None) -> bool:
    lower = (name or '').lower()
    return any(lower.endswith(ext) for ext in _LEDGER_EXTENSIONS)


async def _read_input_files(input_files: list[UploadFile]) -> list[tuple[str, bytes]]:
    files: list[tuple[str, bytes]] = []
    for upload in input_files:
        filename = upload.filename or 'input.xlsx'
        if not _is_ledger_filename(filename):
            continue
        file_bytes = await upload.read()
        if not file_bytes:
            continue
        files.append((filename, file_bytes))
    return files


@router.post('/form-269')
@gateway_router.post('/form-269')
async def process_form_269(
    input_files: list[UploadFile] = File(..., description='Excel ledger files from the selected folder'),
) -> dict:
    """
    Process all Excel files from the uploaded folder and return 269SS and 269ST
    records. Master/reference data is loaded from the bundled JSON file.
    """
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info('Form 269 combined request received')
    log.info('Input files: %s', [f.filename for f in input_files])

    file_data = await _read_input_files(input_files)

    if not file_data:
        return JSONResponse(
            status_code=400,
            content={
                'success': False,
                'detail': 'At least one non-empty ledger Excel file is required',
                'requestId': request_id,
            },
        )

    try:
        response = audit.process(file_data)
        response['requestId'] = request_id
        log.info('Form 269 combined processing complete')
        return response
    except ValueError as exc:
        log.error('Form 269 validation failed: %s', exc)
        return JSONResponse(
            status_code=400,
            content={'success': False, 'detail': str(exc), 'requestId': request_id},
        )
    except Exception as exc:
        log.error('Form 269 processing failed: %s', exc)
        return JSONResponse(
            status_code=500,
            content={'success': False, 'detail': str(exc), 'requestId': request_id},
        )

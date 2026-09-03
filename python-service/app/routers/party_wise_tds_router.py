"""Party Wise TDS Summary HTTP routes."""

from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.engines.party_wise_tds_engine.engine.processor import PartyWiseTdsProcessor
from app.utils.async_work import run_sync
from app.utils.excel_exporter import export_party_wise_tds_summary
from app.utils.logger import get_logger
from app.utils.request_id import resolve_request_id

router = APIRouter(prefix='/api/process', tags=['party-wise-tds'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['party-wise-tds'])


class PartyWiseTdsExportRequest(BaseModel):
    purchaseSummary: list[dict[str, Any]] | None = None
    payableSummary: list[dict[str, Any]] | None = None


@router.post('/party-wise-tds')
@gateway_router.post('/party-wise-tds/validate')
async def process_party_wise_tds(
    request: Request,
    purchase_goods_file: UploadFile = File(..., description='TDS on Purchase of Goods Excel'),
    tds_payable_file: UploadFile = File(..., description='TDS Payable Account Excel'),
) -> dict:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Party Wise TDS Summary request received')
    purchase_bytes = await purchase_goods_file.read()
    payable_bytes = await tds_payable_file.read()
    if not purchase_bytes:
        raise ValueError('TDS on Purchase of Goods file is empty')
    if not payable_bytes:
        raise ValueError('TDS Payable Account file is empty')
    processor = PartyWiseTdsProcessor()
    response = await run_sync(processor.process_dual, purchase_bytes, payable_bytes)
    log.info('Party Wise TDS Summary complete')
    return response


@router.post('/party-wise-tds/export')
@gateway_router.post('/party-wise-tds/export')
async def export_party_wise_tds(
    request: Request,
    payload: PartyWiseTdsExportRequest,
) -> StreamingResponse:
    request_id = resolve_request_id(request)
    log = get_logger(request_id)
    log.info('Party Wise TDS Summary export request received')
    excel_bytes = await run_sync(
        export_party_wise_tds_summary,
        purchase_summary=payload.purchaseSummary,
        payable_summary=payload.payableSummary,
    )
    filename = 'Party_Wise_TDS_Summary.xlsx'
    log.info('Party Wise TDS Summary export generated')
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )

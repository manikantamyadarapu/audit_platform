"""Financials Sales & Purchases pivot + Closing Stock template HTTP routes."""

import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.engines.financials_engine.engine.processor import FinancialsClosingStockProcessor
from app.engines.financials_engine.engine.closing_stock_template import (
    build_closing_stock_template_bytes,
    build_pivots_workbook_bytes,
)
from app.engines.financials_engine.config.product_rule_book import (
    map_pivots_to_closing_stock_categories,
    map_product_names_to_categories,
    map_product_names_to_layouts,
)
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError

router = APIRouter(prefix='/api/process', tags=['financials'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['financials'])
processor = FinancialsClosingStockProcessor()


class PivotRow(BaseModel):
    product: str = ''
    sumOfQuantity: float | int | None = None
    sumOfGross: float | int | None = None


class ExportPivotsRequest(BaseModel):
    salesPivot: list[PivotRow] = Field(default_factory=list)
    purchasesPivot: list[PivotRow] = Field(default_factory=list)


class ExportClosingStockRequest(BaseModel):
    products: list[str] = Field(default_factory=list)
    salesPivot: list[PivotRow] = Field(default_factory=list)
    purchasesPivot: list[PivotRow] = Field(default_factory=list)
    companyName: str = ''
    address: str = ''
    financialYear: str = 'AY 2025-26'


async def _process_financials_pivot(
    sales_file: UploadFile,
    purchases_file: UploadFile,
) -> dict[str, Any]:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info(
        'Financials pivot request: sales={} purchases={}',
        sales_file.filename,
        purchases_file.filename,
    )

    sales_bytes = await sales_file.read()
    purchases_bytes = await purchases_file.read()
    if not sales_bytes:
        return JSONResponse(
            status_code=400,
            content={'success': False, 'detail': 'Sales file is empty', 'requestId': request_id},
        )
    if not purchases_bytes:
        return JSONResponse(
            status_code=400,
            content={'success': False, 'detail': 'Purchases file is empty', 'requestId': request_id},
        )

    try:
        response = processor.process(
            sales_file.filename or 'sales.xlsx',
            sales_bytes,
            purchases_file.filename or 'purchases.xlsx',
            purchases_bytes,
        )
        response['requestId'] = request_id
        return response
    except SheetValidationError:
        raise
    except Exception as exc:
        log.error('Financials pivot failed: {}', exc)
        return JSONResponse(
            status_code=500,
            content={'success': False, 'detail': str(exc), 'requestId': request_id},
        )


@router.post('/financials')
@gateway_router.post('/financials/validate')
async def process_financials_pivot(
    sales_file: UploadFile = File(...),
    purchases_file: UploadFile = File(...),
) -> dict[str, Any]:
    return await _process_financials_pivot(sales_file, purchases_file)


@router.post('/financials/export-pivots')
@gateway_router.post('/financials/export-pivots')
async def export_financials_pivots(payload: ExportPivotsRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)
    log.info(
        'Financials pivots export: sales={} purchases={}',
        len(payload.salesPivot),
        len(payload.purchasesPivot),
    )
    excel_bytes = build_pivots_workbook_bytes(
        sales_pivot=[row.model_dump() for row in payload.salesPivot],
        purchases_pivot=[row.model_dump() for row in payload.purchasesPivot],
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'Financials-Sales-Purchases-Pivots-{timestamp}.xlsx'
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.post('/financials/export-closing-stock')
@gateway_router.post('/financials/export-closing-stock')
async def export_closing_stock_template(payload: ExportClosingStockRequest) -> StreamingResponse:
    request_id = str(uuid.uuid4())
    log = get_logger(request_id)

    if payload.salesPivot or payload.purchasesPivot:
        mapped = map_pivots_to_closing_stock_categories(
            sales_pivot=[row.model_dump() for row in payload.salesPivot],
            purchases_pivot=[row.model_dump() for row in payload.purchasesPivot],
        )
        products_by_category = mapped['productsByCategory']
        layout_by_category = mapped['layoutByCategory']
    else:
        products_by_category = map_product_names_to_categories(payload.products)
        layout_by_category = map_product_names_to_layouts(payload.products)

    mapped_count = sum(len(rows) for rows in products_by_category.values())
    log.info('Closing Stock template export: mapped_products={}', mapped_count)
    excel_bytes = build_closing_stock_template_bytes(
        products_by_category=products_by_category,
        layout_by_category=layout_by_category,
        company_name=payload.companyName,
        address=payload.address,
        financial_year=payload.financialYear or 'AY 2025-26',
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'Closing-Stock-Jewels-{timestamp}.xlsx'
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

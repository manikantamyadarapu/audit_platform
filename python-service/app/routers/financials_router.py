"""Financials Sales & Purchases pivot + Opening + MR/DC + Closing Stock HTTP routes."""

import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.engines.financials_engine.engine.processor import FinancialsClosingStockProcessor
from app.engines.financials_engine.engine.closing_stock_template import (
    build_closing_stock_template_bytes,
    build_pivots_workbook_bytes,
)
from app.engines.financials_engine.config.product_rule_book import (
    format_closing_stock_mapping_response,
    get_closing_stock_rule_book_payload,
    map_pivots_to_closing_stock_categories,
)
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError

router = APIRouter(prefix='/api/process', tags=['financials'])
gateway_router = APIRouter(prefix='/api/v1/process', tags=['financials'])
processor = FinancialsClosingStockProcessor()


def _request_id(request: Request) -> str:
    incoming = request.headers.get('x-request-id')
    return incoming.strip() if incoming and incoming.strip() else str(uuid.uuid4())


class PivotRow(BaseModel):
    product: str = ''
    sumOfQuantity: float | int | None = None
    sumOfGross: float | int | None = None


class BucketPivotRow(BaseModel):
    product: str = ''
    bucket: str = ''
    sumOfQuantity: float | int | None = None
    sumOfGross: float | int | None = None


class ExportPivotsRequest(BaseModel):
    salesPivot: list[PivotRow] = Field(default_factory=list)
    purchasesPivot: list[PivotRow] = Field(default_factory=list)
    openingPivot: list[PivotRow] = Field(default_factory=list)
    receiptsPivot: list[BucketPivotRow] = Field(default_factory=list)
    issuesPivot: list[BucketPivotRow] = Field(default_factory=list)


class ExportClosingStockRequest(BaseModel):
    products: list[str] = Field(default_factory=list)
    salesPivot: list[PivotRow] = Field(default_factory=list)
    purchasesPivot: list[PivotRow] = Field(default_factory=list)
    openingPivot: list[PivotRow] = Field(default_factory=list)
    receiptsPivot: list[BucketPivotRow] = Field(default_factory=list)
    issuesPivot: list[BucketPivotRow] = Field(default_factory=list)
    companyName: str = ''
    address: str = ''
    financialYear: str = 'AY 2025-26'


async def _process_financials_pivot(
    sales_file: UploadFile,
    purchases_file: UploadFile,
    opening_qty_file: UploadFile,
    previous_year_file: UploadFile,
    mr_file: UploadFile | None,
    dc_file: UploadFile | None,
    request_id: str,
) -> dict[str, Any]:
    log = get_logger(request_id)
    log.info(
        'Financials pivot request: sales={} purchases={} opening_qty={} previous_year={} mr={} dc={}',
        sales_file.filename,
        purchases_file.filename,
        opening_qty_file.filename,
        previous_year_file.filename,
        mr_file.filename if mr_file else None,
        dc_file.filename if dc_file else None,
    )

    sales_bytes = await sales_file.read()
    purchases_bytes = await purchases_file.read()
    opening_qty_bytes = await opening_qty_file.read()
    previous_year_bytes = await previous_year_file.read()
    mr_bytes = await mr_file.read() if mr_file is not None else None
    dc_bytes = await dc_file.read() if dc_file is not None else None

    for label, payload in (
        ('Sales', sales_bytes),
        ('Purchases', purchases_bytes),
        ('Opening Quantity', opening_qty_bytes),
        ('Previous Year Closing Stock', previous_year_bytes),
    ):
        if not payload:
            return JSONResponse(
                status_code=400,
                content={
                    'success': False,
                    'detail': f'{label} file is empty',
                    'requestId': request_id,
                },
            )

    # MR and DC are paired — both required when either is supplied.
    if (mr_bytes and not dc_bytes) or (dc_bytes and not mr_bytes):
        return JSONResponse(
            status_code=400,
            content={
                'success': False,
                'detail': 'Upload both Material Receipts (MR) and Delivery Challans (DC) together.',
                'requestId': request_id,
            },
        )
    if mr_bytes is not None and len(mr_bytes) == 0:
        return JSONResponse(
            status_code=400,
            content={
                'success': False,
                'detail': 'Material Receipts (MR) file is empty',
                'requestId': request_id,
            },
        )
    if dc_bytes is not None and len(dc_bytes) == 0:
        return JSONResponse(
            status_code=400,
            content={
                'success': False,
                'detail': 'Delivery Challans (DC) file is empty',
                'requestId': request_id,
            },
        )

    try:
        response = processor.process(
            sales_file.filename or 'sales.xlsx',
            sales_bytes,
            purchases_file.filename or 'purchases.xlsx',
            purchases_bytes,
            opening_qty_file_name=opening_qty_file.filename or 'opening-quantity.xlsx',
            opening_qty_bytes=opening_qty_bytes,
            previous_year_file_name=previous_year_file.filename or 'previous-year-closing.xlsx',
            previous_year_bytes=previous_year_bytes,
            mr_file_name=(mr_file.filename if mr_file else None) or 'MR.xlsx',
            mr_bytes=mr_bytes,
            dc_file_name=(dc_file.filename if dc_file else None) or 'DC.xlsx',
            dc_bytes=dc_bytes,
        )
        response['requestId'] = request_id
        return response
    except SheetValidationError as exc:
        content = exc.to_response()
        content['requestId'] = request_id
        return JSONResponse(status_code=422, content=content)
    except Exception as exc:
        log.error('Financials pivot failed: {}', exc)
        return JSONResponse(
            status_code=500,
            content={'success': False, 'detail': str(exc), 'requestId': request_id},
        )


@router.post('/financials')
@gateway_router.post('/financials/validate')
async def process_financials_pivot(
    request: Request,
    sales_file: UploadFile = File(...),
    purchases_file: UploadFile = File(...),
    opening_qty_file: UploadFile = File(...),
    previous_year_file: UploadFile = File(...),
    mr_file: UploadFile | None = File(None),
    dc_file: UploadFile | None = File(None),
) -> dict[str, Any]:
    return await _process_financials_pivot(
        sales_file,
        purchases_file,
        opening_qty_file,
        previous_year_file,
        mr_file,
        dc_file,
        _request_id(request),
    )


@router.post('/financials/export-pivots')
@gateway_router.post('/financials/export-pivots')
async def export_financials_pivots(
    request: Request,
    payload: ExportPivotsRequest,
) -> StreamingResponse:
    request_id = _request_id(request)
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
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )


@router.get('/financials/closing-stock-rule-book')
@gateway_router.get('/financials/closing-stock-rule-book')
async def get_closing_stock_rule_book(request: Request) -> dict[str, Any]:
    """Current Rule Book JSON (single source of truth) plus content fingerprint."""
    return {
        **get_closing_stock_rule_book_payload(),
        'requestId': _request_id(request),
    }


@router.post('/financials/remap-closing-stock')
@gateway_router.post('/financials/remap-closing-stock')
async def remap_closing_stock(
    request: Request,
    payload: ExportPivotsRequest,
) -> dict[str, Any]:
    """Rebuild Closing Stock mapping from current Rule Book + pivot rows."""
    request_id = _request_id(request)
    log = get_logger(request_id)
    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[row.model_dump() for row in payload.salesPivot],
        purchases_pivot=[row.model_dump() for row in payload.purchasesPivot],
        opening_pivot=[row.model_dump() for row in payload.openingPivot],
        receipts_pivot=[row.model_dump() for row in payload.receiptsPivot],
        issues_pivot=[row.model_dump() for row in payload.issuesPivot],
    )
    log.info(
        'Closing Stock remap: fingerprint={} products={}',
        mapped.get('ruleBookFingerprint'),
        mapped.get('productsDisplayed'),
    )
    return {
        'success': True,
        **format_closing_stock_mapping_response(mapped),
        'mappedOpeningProducts': mapped.get('mappedOpeningProducts', []),
        'unmappedOpeningProducts': mapped.get('unmappedOpeningProducts', []),
        'unmappedReceiptsProducts': mapped.get('unmappedReceiptsProducts', []),
        'unmappedIssuesProducts': mapped.get('unmappedIssuesProducts', []),
        'netMovement': mapped.get('netMovement', {}),
        'summary': {
            'ruleBookFingerprint': mapped.get('ruleBookFingerprint'),
            'ruleBookProductCounts': mapped.get('ruleBookProductCounts', {}),
            'ruleBookProductTotal': mapped.get('ruleBookProductTotal', 0),
            'productsWithSalesData': mapped.get('productsWithSalesData', 0),
            'productsWithPurchaseData': mapped.get('productsWithPurchaseData', 0),
            'productsWithOpeningData': mapped.get('productsWithOpeningData', 0),
            'productsWithReceiptsData': mapped.get('productsWithReceiptsData', 0),
            'productsWithIssuesData': mapped.get('productsWithIssuesData', 0),
            'productsDisplayed': mapped.get('productsDisplayed', 0),
            'mappedProductCount': mapped.get('productsDisplayed', 0),
            'unmappedProductCount': len(mapped.get('unmappedProducts', [])),
            'reconciliation': mapped.get('reconciliation', {}),
            'netMovementQty': (mapped.get('netMovement') or {}).get('netMovementQty'),
            'netMovementAmt': (mapped.get('netMovement') or {}).get('netMovementAmt'),
            'netMovementFormula': (mapped.get('netMovement') or {}).get('formula'),
        },
        'requestId': request_id,
    }


@router.post('/financials/export-closing-stock')
@gateway_router.post('/financials/export-closing-stock')
async def export_closing_stock_template(
    request: Request,
    payload: ExportClosingStockRequest,
) -> StreamingResponse:
    request_id = _request_id(request)
    log = get_logger(request_id)

    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[row.model_dump() for row in payload.salesPivot],
        purchases_pivot=[row.model_dump() for row in payload.purchasesPivot],
        opening_pivot=[row.model_dump() for row in payload.openingPivot],
        receipts_pivot=[row.model_dump() for row in payload.receiptsPivot],
        issues_pivot=[row.model_dump() for row in payload.issuesPivot],
    )
    products_by_category = mapped['productsByCategory']
    layout_by_category = mapped['layoutByCategory']

    mapped_count = sum(len(rows) for rows in products_by_category.values())
    log.info(
        'Closing Stock template export: mapped_products={} fingerprint={}',
        mapped_count,
        mapped.get('ruleBookFingerprint'),
    )
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
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )

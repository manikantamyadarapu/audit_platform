"""Financials Sales & Purchases pivot + Opening Stock + Closing Stock template HTTP routes."""

import json
import uuid
from datetime import datetime
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.engines.financials_engine.engine.processor import FinancialsClosingStockProcessor
from app.engines.financials_engine.engine.closing_stock_template import (
    build_closing_stock_template_bytes,
    build_pivots_workbook_bytes,
)
from app.engines.financials_engine.engine.jubilee_hills_template import (
    build_jubilee_hills_structure_bytes,
    build_jubilee_hills_workbook_bytes,
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
    model_config = {'extra': 'allow'}

    product: str = ''
    sumOfQuantity: float | int | None = None
    sumOfGross: float | int | None = None
    ruleBookProduct: str | None = None
    category: str | None = None
    subcategory: str | None = None
    status: str | None = None


class LocationPivotTree(BaseModel):
    model_config = {'extra': 'ignore'}

    jubileeHills: list[PivotRow] = Field(default_factory=list)
    kokapet: list[PivotRow] = Field(default_factory=list)
    internalBasheerbagh: list[PivotRow] = Field(default_factory=list)


class ExportPivotsRequest(BaseModel):
    salesPivot: list[PivotRow] = Field(default_factory=list)
    purchasesPivot: list[PivotRow] = Field(default_factory=list)
    openingPivot: list[PivotRow] = Field(default_factory=list)
    salesReturnPivot: list[PivotRow] = Field(default_factory=list)
    purchaseReturnPivot: list[PivotRow] = Field(default_factory=list)
    supplierDebitNotePivot: list[PivotRow] = Field(default_factory=list)
    supplierCreditNotePivot: list[PivotRow] = Field(default_factory=list)
    mrPivots: LocationPivotTree = Field(default_factory=LocationPivotTree)
    dcPivots: LocationPivotTree = Field(default_factory=LocationPivotTree)
    destinationBranch: str = ''
    sourceAverageRates: dict[str, Any] = Field(default_factory=dict)
    receiptRateMappings: list[dict[str, Any]] = Field(default_factory=list)


class JubileeHillsTemplateRequest(BaseModel):
    companyName: str = ''
    address: str = ''
    financialYear: str = 'AY 2025-26'
    layoutByCategory: dict[str, list[dict[str, Any]]] | None = None
    salesPivot: list[PivotRow] = Field(default_factory=list)
    purchasesPivot: list[PivotRow] = Field(default_factory=list)
    openingPivot: list[PivotRow] = Field(default_factory=list)
    mrPivots: LocationPivotTree = Field(default_factory=LocationPivotTree)
    dcPivots: LocationPivotTree = Field(default_factory=LocationPivotTree)


class ExportClosingStockRequest(BaseModel):
    products: list[str] = Field(default_factory=list)
    salesPivot: list[PivotRow] = Field(default_factory=list)
    purchasesPivot: list[PivotRow] = Field(default_factory=list)
    openingPivot: list[PivotRow] = Field(default_factory=list)
    mrPivots: LocationPivotTree = Field(default_factory=LocationPivotTree)
    dcPivots: LocationPivotTree = Field(default_factory=LocationPivotTree)
    companyName: str = ''
    address: str = ''
    financialYear: str = 'AY 2025-26'
    destinationBranch: str = ''
    sourceAverageRates: dict[str, Any] = Field(default_factory=dict)
    receiptRateMappings: list[dict[str, Any]] = Field(default_factory=list)


def _parse_source_average_rates(raw: str) -> dict[str, Any]:
    try:
        parsed = json.loads(raw or '{}')
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _parse_receipt_rate_mappings(raw: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(raw or '[]')
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [row for row in parsed if isinstance(row, dict)]


def _dump_location_pivots(tree: LocationPivotTree) -> dict[str, list[dict[str, Any]]]:
    return {
        'jubileeHills': [row.model_dump() for row in tree.jubileeHills],
        'kokapet': [row.model_dump() for row in tree.kokapet],
        'internalBasheerbagh': [row.model_dump() for row in tree.internalBasheerbagh],
    }


async def _process_financials_pivot(
    sales_file: UploadFile,
    purchases_file: UploadFile,
    opening_qty_file: UploadFile,
    previous_year_file: UploadFile,
    request_id: str,
    mr_file: UploadFile,
    dc_file: UploadFile,
    destination_branch: str | None = None,
    source_average_rates: dict[str, Any] | None = None,
    receipt_rate_mappings: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    log = get_logger(request_id)
    log.info(
        'Financials pivot request: sales={} purchases={} opening_qty={} previous_year={} mr={} dc={}',
        sales_file.filename,
        purchases_file.filename,
        opening_qty_file.filename,
        previous_year_file.filename,
        mr_file.filename,
        dc_file.filename,
    )

    sales_bytes = await sales_file.read()
    purchases_bytes = await purchases_file.read()
    opening_qty_bytes = await opening_qty_file.read()
    previous_year_bytes = await previous_year_file.read()
    mr_bytes = await mr_file.read()
    dc_bytes = await dc_file.read()

    for label, payload in (
        ('Sales', sales_bytes),
        ('Purchases', purchases_bytes),
        ('Opening Quantity', opening_qty_bytes),
        ('Previous Year Closing Stock', previous_year_bytes),
        ('MR', mr_bytes),
        ('DC', dc_bytes),
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
            mr_file_name=mr_file.filename or 'mr.xlsx',
            mr_bytes=mr_bytes,
            dc_file_name=dc_file.filename or 'dc.xlsx',
            dc_bytes=dc_bytes,
            destination_branch=destination_branch,
            source_average_rates=source_average_rates,
            receipt_rate_mappings=receipt_rate_mappings,
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


async def _process_financials_sales_purchases(
    sales_file: UploadFile,
    purchases_file: UploadFile,
    opening_qty_file: UploadFile,
    previous_year_file: UploadFile,
    request_id: str,
) -> dict[str, Any]:
    log = get_logger(request_id)
    log.info(
        'Financials sales/purchases/opening pivot request: sales={} purchases={} opening_qty={} previous_year={}',
        sales_file.filename,
        purchases_file.filename,
        opening_qty_file.filename,
        previous_year_file.filename,
    )

    sales_bytes = await sales_file.read()
    purchases_bytes = await purchases_file.read()
    opening_qty_bytes = await opening_qty_file.read()
    previous_year_bytes = await previous_year_file.read()

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
        )
        response['requestId'] = request_id
        return response
    except SheetValidationError as exc:
        content = exc.to_response()
        content['requestId'] = request_id
        return JSONResponse(status_code=422, content=content)
    except Exception as exc:
        log.error('Financials sales/purchases/opening pivot failed: {}', exc)
        return JSONResponse(
            status_code=500,
            content={'success': False, 'detail': str(exc), 'requestId': request_id},
        )


@router.post('/financials/basheerbagh')
@gateway_router.post('/financials/validate/basheerbagh')
async def process_basheerbagh_financials(
    request: Request,
    sales_file: UploadFile = File(...),
    purchases_file: UploadFile = File(...),
    opening_qty_file: UploadFile = File(...),
    previous_year_file: UploadFile = File(...),
    mr_file: UploadFile = File(...),
    dc_file: UploadFile = File(...),
    source_average_rates: str = Form('{}'),
    receipt_rate_mappings: str = Form('[]'),
) -> dict[str, Any]:
    return await _process_financials_pivot(
        sales_file,
        purchases_file,
        opening_qty_file,
        previous_year_file,
        _request_id(request),
        mr_file=mr_file,
        dc_file=dc_file,
        destination_branch='basheerbagh',
        source_average_rates=_parse_source_average_rates(source_average_rates),
        receipt_rate_mappings=_parse_receipt_rate_mappings(receipt_rate_mappings),
    )


@router.post('/financials/kokapet')
@gateway_router.post('/financials/validate/kokapet')
async def process_kokapet_financials(
    request: Request,
    sales_file: UploadFile = File(...),
    purchases_file: UploadFile = File(...),
    opening_qty_file: UploadFile = File(...),
    previous_year_file: UploadFile = File(...),
    mr_file: UploadFile = File(...),
    dc_file: UploadFile = File(...),
    source_average_rates: str = Form('{}'),
    receipt_rate_mappings: str = Form('[]'),
) -> dict[str, Any]:
    return await _process_financials_pivot(
        sales_file,
        purchases_file,
        opening_qty_file,
        previous_year_file,
        _request_id(request),
        mr_file=mr_file,
        dc_file=dc_file,
        destination_branch='kokapet',
        source_average_rates=_parse_source_average_rates(source_average_rates),
        receipt_rate_mappings=_parse_receipt_rate_mappings(receipt_rate_mappings),
    )


@router.post('/financials/jubilee-hills')
@gateway_router.post('/financials/jubilee-hills')
@gateway_router.post('/financials/validate/jubilee-hills')
async def process_jubilee_hills_financials(
    request: Request,
    sales_file: UploadFile = File(...),
    purchases_file: UploadFile = File(...),
    opening_qty_file: UploadFile = File(...),
    previous_year_file: UploadFile = File(...),
    sales_return_file: UploadFile = File(...),
    purchase_return_file: UploadFile = File(...),
    credit_note_file: UploadFile = File(...),
    debit_note_file: UploadFile = File(...),
    mr_file: UploadFile | None = File(None),
    dc_file: UploadFile | None = File(None),
    saved_opening_mappings: str = Form('[]'),
    source_average_rates: str = Form('{}'),
    receipt_rate_mappings: str = Form('[]'),
) -> dict[str, Any]:
    """Jubilee Hills: Sales, Purchases, Opening Quantity, returns, supplier notes, previous year, and optional MR/DC."""
    request_id = _request_id(request)
    log = get_logger(request_id)
    uploads = (
        ('Sales', sales_file),
        ('Purchases', purchases_file),
        ('Opening Quantity', opening_qty_file),
        ('Previous Year Closing Stock', previous_year_file),
        ('Sales Return', sales_return_file),
        ('Purchase Return', purchase_return_file),
        ('Credit Notes from Suppliers', credit_note_file),
        ('Debit Notes from Suppliers', debit_note_file),
    )
    payloads: dict[str, bytes] = {}
    for label, upload in uploads:
        payloads[label] = await upload.read()
        if not payloads[label]:
            return JSONResponse(
                status_code=400,
                content={
                    'success': False,
                    'detail': f'{label} file is empty',
                    'requestId': request_id,
                },
            )
    try:
        try:
            saved_mappings = json.loads(saved_opening_mappings or '[]')
        except json.JSONDecodeError:
            saved_mappings = []
        if not isinstance(saved_mappings, list):
            saved_mappings = []
        response = processor.process_jubilee_hills(
            sales_file.filename or 'sales.xlsx',
            payloads['Sales'],
            purchases_file.filename or 'purchases.xlsx',
            payloads['Purchases'],
            opening_qty_file_name=opening_qty_file.filename or 'opening-quantity.xlsx',
            opening_qty_bytes=payloads['Opening Quantity'],
            previous_year_file_name=previous_year_file.filename or 'previous-year-closing.xlsx',
            previous_year_bytes=payloads['Previous Year Closing Stock'],
            sales_return_file_name=sales_return_file.filename or 'sales-return.xlsx',
            sales_return_bytes=payloads['Sales Return'],
            purchase_return_file_name=purchase_return_file.filename or 'purchase-return.xlsx',
            purchase_return_bytes=payloads['Purchase Return'],
            credit_note_file_name=credit_note_file.filename or 'credit-notes-from-suppliers.xlsx',
            credit_note_bytes=payloads['Credit Notes from Suppliers'],
            debit_note_file_name=debit_note_file.filename or 'debit-notes-from-suppliers.xlsx',
            debit_note_bytes=payloads['Debit Notes from Suppliers'],
            mr_file_name=mr_file.filename if mr_file is not None else '',
            mr_bytes=await mr_file.read() if mr_file is not None else None,
            dc_file_name=dc_file.filename if dc_file is not None else '',
            dc_bytes=await dc_file.read() if dc_file is not None else None,
            saved_opening_mappings=saved_mappings,
            source_average_rates=_parse_source_average_rates(source_average_rates),
            receipt_rate_mappings=_parse_receipt_rate_mappings(receipt_rate_mappings),
        )
        response['requestId'] = request_id
        return response
    except SheetValidationError as exc:
        content = exc.to_response()
        content['requestId'] = request_id
        return JSONResponse(status_code=422, content=content)
    except Exception as exc:
        log.error('Jubilee Hills financials failed: {}', exc)
        return JSONResponse(
            status_code=500,
            content={'success': False, 'detail': str(exc), 'requestId': request_id},
        )


@router.post('/financials/sales-purchases')
@gateway_router.post('/financials/validate-sales-purchases')
async def process_financials_sales_purchases(
    request: Request,
    sales_file: UploadFile = File(...),
    purchases_file: UploadFile = File(...),
    opening_qty_file: UploadFile = File(...),
    previous_year_file: UploadFile = File(...),
) -> dict[str, Any]:
    return await _process_financials_sales_purchases(
        sales_file,
        purchases_file,
        opening_qty_file,
        previous_year_file,
        _request_id(request),
    )


@router.post('/financials/sales-purchases-pivots')
@gateway_router.post('/financials/validate-sales-purchases-pivots')
async def process_sales_purchases_pivots(
    request: Request,
    sales_file: UploadFile = File(...),
    purchases_file: UploadFile = File(...),
    opening_qty_file: UploadFile | None = File(None),
    previous_year_file: UploadFile | None = File(None),
) -> dict[str, Any]:
    """Sales and Purchases pivots, plus Opening Stock when both opening files are sent."""
    request_id = _request_id(request)
    log = get_logger(request_id)
    log.info(
        'Sales/Purchases pivots: sales={} purchases={} opening={} previous_year={}',
        sales_file.filename,
        purchases_file.filename,
        opening_qty_file.filename if opening_qty_file else None,
        previous_year_file.filename if previous_year_file else None,
    )
    sales_bytes = await sales_file.read()
    purchases_bytes = await purchases_file.read()
    opening_bytes = await opening_qty_file.read() if opening_qty_file else b''
    previous_bytes = await previous_year_file.read() if previous_year_file else b''
    for label, payload in (('Sales', sales_bytes), ('Purchases', purchases_bytes)):
        if not payload:
            return JSONResponse(
                status_code=400,
                content={'success': False, 'detail': f'{label} file is empty', 'requestId': request_id},
            )
    if bool(opening_bytes) != bool(previous_bytes):
        return JSONResponse(
            status_code=400,
            content={
                'success': False,
                'detail': 'Opening Stock needs both the Opening Quantity file and Previous Year Financials.',
                'requestId': request_id,
            },
        )
    try:
        response = processor.process_sales_purchases_pivots(
            sales_file.filename or 'sales.xlsx',
            sales_bytes,
            purchases_file.filename or 'purchases.xlsx',
            purchases_bytes,
            opening_qty_file_name=opening_qty_file.filename if opening_qty_file else '',
            opening_qty_bytes=opening_bytes or None,
            previous_year_file_name=previous_year_file.filename if previous_year_file else '',
            previous_year_bytes=previous_bytes or None,
        )
        response['requestId'] = request_id
        return response
    except SheetValidationError as exc:
        content = exc.to_response()
        content['requestId'] = request_id
        return JSONResponse(status_code=422, content=content)
    except Exception as exc:
        log.error('Sales/Purchases pivots failed: {}', exc)
        return JSONResponse(
            status_code=500,
            content={'success': False, 'detail': str(exc), 'requestId': request_id},
        )


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


@router.post('/financials/export-pivots/basheerbagh')
@gateway_router.post('/financials/export-pivots/basheerbagh')
async def export_basheerbagh_pivots(
    request: Request,
    payload: ExportPivotsRequest,
) -> StreamingResponse:
    return await export_financials_pivots(request, payload)


@router.post('/financials/export-pivots/kokapet')
@gateway_router.post('/financials/export-pivots/kokapet')
async def export_kokapet_pivots(
    request: Request,
    payload: ExportPivotsRequest,
) -> StreamingResponse:
    return await export_financials_pivots(request, payload)


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
        mr_pivots=_dump_location_pivots(payload.mrPivots),
        dc_pivots=_dump_location_pivots(payload.dcPivots),
        destination_branch=payload.destinationBranch or None,
        source_average_rates=payload.sourceAverageRates,
        receipt_rate_mappings=payload.receiptRateMappings,
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
        'summary': {
            'ruleBookFingerprint': mapped.get('ruleBookFingerprint'),
            'ruleBookProductCounts': mapped.get('ruleBookProductCounts', {}),
            'ruleBookProductTotal': mapped.get('ruleBookProductTotal', 0),
            'productsWithSalesData': mapped.get('productsWithSalesData', 0),
            'productsWithPurchaseData': mapped.get('productsWithPurchaseData', 0),
            'productsWithOpeningData': mapped.get('productsWithOpeningData', 0),
            'productsDisplayed': mapped.get('productsDisplayed', 0),
            'mappedProductCount': mapped.get('productsDisplayed', 0),
            'unmappedProductCount': len(mapped.get('unmappedProducts', [])),
            'reconciliation': mapped.get('reconciliation', {}),
        },
        'requestId': request_id,
    }


@router.post('/financials/jubilee-hills/place')
@gateway_router.post('/financials/jubilee-hills/place')
async def place_jubilee_hills_sheets(
    request: Request,
    payload: ExportPivotsRequest,
) -> dict[str, Any]:
    """Rebuild Jubilee Hills sheets after an opening amount is mapped."""
    from app.engines.financials_engine.engine.jubilee_hills_placement import (
        apply_jubilee_hills_placement,
    )

    from app.engines.financials_engine.engine.jubilee_sales_purchase_nets import (
        build_jubilee_sales_purchase_nets,
    )

    sales_pivot = [row.model_dump() for row in payload.salesPivot]
    purchases_pivot = [row.model_dump() for row in payload.purchasesPivot]
    nets = build_jubilee_sales_purchase_nets(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        sales_return_pivot=[row.model_dump() for row in payload.salesReturnPivot],
        purchase_return_pivot=[row.model_dump() for row in payload.purchaseReturnPivot],
        debit_note_pivot=[row.model_dump() for row in payload.supplierDebitNotePivot],
        credit_note_pivot=[row.model_dump() for row in payload.supplierCreditNotePivot],
    )
    response = apply_jubilee_hills_placement(
        {
            'salesPivot': sales_pivot,
            'purchasesPivot': purchases_pivot,
            'openingPivot': [row.model_dump() for row in payload.openingPivot],
            'summary': {},
        },
        sales_pivot=nets['netSalesPivot'],
        purchases_pivot=nets['netPurchasesPivot'],
        mr_pivots=_dump_location_pivots(payload.mrPivots),
        dc_pivots=_dump_location_pivots(payload.dcPivots),
        source_average_rates=payload.sourceAverageRates,
        receipt_rate_mappings=payload.receiptRateMappings,
    )
    return {
        'success': True,
        'productsByCategory': response.get('productsByCategory'),
        'layoutByCategory': response.get('layoutByCategory'),
        'unmappedProducts': response.get('unmappedProducts'),
        'unmappedProductDetails': response.get('unmappedProductDetails'),
        'receiptAmountReview': response.get('receiptAmountReview') or [],
        'productAverageRates': response.get('productAverageRates') or [],
        'summary': response.get('summary'),
        'requestId': _request_id(request),
    }


@router.post('/financials/jubilee-hills/template')
@gateway_router.post('/financials/jubilee-hills/template')
async def export_jubilee_hills_structure(
    request: Request,
    payload: JubileeHillsTemplateRequest,
) -> StreamingResponse:
    """Blank Jubilee Hills workbook. Does not read branch files or fill measures."""
    request_id = _request_id(request)
    excel_bytes = build_jubilee_hills_workbook_bytes(
        company_name=payload.companyName,
        address=payload.address,
        financial_year=payload.financialYear or 'AY 2025-26',
        layout_by_category=payload.layoutByCategory,
        sales_pivot=[row.model_dump() for row in payload.salesPivot],
        purchases_pivot=[row.model_dump() for row in payload.purchasesPivot],
        opening_pivot=[row.model_dump() for row in payload.openingPivot],
        mr_pivots=_dump_location_pivots(payload.mrPivots),
        dc_pivots=_dump_location_pivots(payload.dcPivots),
    )
    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
    filename = f'Jubilee-Hills-Financials-{timestamp}.xlsx'
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'x-request-id': request_id,
        },
    )


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
        mr_pivots=_dump_location_pivots(payload.mrPivots),
        dc_pivots=_dump_location_pivots(payload.dcPivots),
        destination_branch=payload.destinationBranch or None,
        source_average_rates=payload.sourceAverageRates,
        receipt_rate_mappings=payload.receiptRateMappings,
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
        sales_pivot=[row.model_dump() for row in payload.salesPivot],
        purchases_pivot=[row.model_dump() for row in payload.purchasesPivot],
        opening_pivot=[row.model_dump() for row in payload.openingPivot],
        mr_pivots=_dump_location_pivots(payload.mrPivots),
        dc_pivots=_dump_location_pivots(payload.dcPivots),
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


@router.post('/financials/export-closing-stock/basheerbagh')
@gateway_router.post('/financials/export-closing-stock/basheerbagh')
async def export_basheerbagh_closing_stock(
    request: Request,
    payload: ExportClosingStockRequest,
) -> StreamingResponse:
    return await export_closing_stock_template(request, payload)


@router.post('/financials/export-closing-stock/kokapet')
@gateway_router.post('/financials/export-closing-stock/kokapet')
async def export_kokapet_closing_stock(
    request: Request,
    payload: ExportClosingStockRequest,
) -> StreamingResponse:
    return await export_closing_stock_template(request, payload)

"""Contract tests for the Financials HTTP boundary."""

from uuid import UUID

from starlette.requests import Request

from app.routers.financials_router import (
    ExportClosingStockRequest,
    ExportPivotsRequest,
    PivotRow,
    _request_id,
)


def _request(headers: dict[str, str] | None = None) -> Request:
    raw_headers = [
        (name.lower().encode('ascii'), value.encode('utf-8'))
        for name, value in (headers or {}).items()
    ]
    return Request({'type': 'http', 'headers': raw_headers})


def test_request_id_preserves_gateway_correlation_id() -> None:
    assert _request_id(_request({'x-request-id': 'gateway-request-123'})) == 'gateway-request-123'


def test_request_id_generates_fallback_when_header_is_blank() -> None:
    request_id = _request_id(_request({'x-request-id': '  '}))
    UUID(request_id)


def test_financials_export_models_match_gateway_payload() -> None:
    row = PivotRow(product='Gold Ring', sumOfQuantity=2, sumOfGross=20000)
    pivots = ExportPivotsRequest(salesPivot=[row], purchasesPivot=[row], openingPivot=[row])
    closing_stock = ExportClosingStockRequest(
        products=['Gold Ring'],
        salesPivot=pivots.salesPivot,
        purchasesPivot=pivots.purchasesPivot,
        openingPivot=pivots.openingPivot,
    )

    assert closing_stock.financialYear == 'AY 2025-26'
    assert closing_stock.salesPivot[0].product == 'Gold Ring'
    assert closing_stock.model_dump()['openingPivot'][0]['sumOfGross'] == 20000

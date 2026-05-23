from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.sales_engine.services.diamond_rate_store import api_response_from_stored, load_rule_book, save_rule_book

router = APIRouter(prefix='/api/diamond-rate-rules', tags=['diamond-rate-rules'])
gateway_router = APIRouter(prefix='/api/v1/diamond-rate-rules', tags=['diamond-rate-rules'])


class DiamondProductRates(BaseModel):
    min_rate: float | None = None
    max_rate: float | None = None


class DiamondRateRuleBookPayload(BaseModel):
    products: dict[str, DiamondProductRates] = Field(default_factory=dict)
    uplift_percent: int | None = None
    deviation_percent: int | None = None


def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {'success': True, **data}


def _payload_to_dict(payload: DiamondRateRuleBookPayload) -> dict[str, Any]:
    products = {
        key: {'min_rate': spec.min_rate, 'max_rate': spec.max_rate}
        for key, spec in payload.products.items()
    }
    return {
        'products': products,
        'uplift_percent': payload.uplift_percent,
        'deviation_percent': payload.deviation_percent,
    }


@router.get('')
@gateway_router.get('')
async def get_diamond_rate_rules() -> dict[str, Any]:
    stored = load_rule_book()
    return _success(api_response_from_stored(stored))


@router.post('')
@gateway_router.post('')
async def post_diamond_rate_rules(payload: DiamondRateRuleBookPayload) -> dict[str, Any]:
    saved = save_rule_book(_payload_to_dict(payload))
    return _success(saved)

from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.sales_engine.services.metal_rate_store import api_response_from_stored, load_rule_book, save_rule_book

router = APIRouter(prefix='/api/rate-rules', tags=['rate-rules'])
gateway_router = APIRouter(prefix='/api/v1/rate-rules', tags=['rate-rules'])


class RateRuleBookPayload(BaseModel):
    rates: dict[str, float | None] = Field(default_factory=dict)
    allowed_variation_percent: int | None = None

    model_config = {'populate_by_name': True}


def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {'success': True, **data}


@router.get('')
@gateway_router.get('')
async def get_rate_rules() -> dict[str, Any]:
    stored = load_rule_book()
    return _success(api_response_from_stored(stored))


@router.post('')
@gateway_router.post('')
async def post_rate_rules(payload: RateRuleBookPayload) -> dict[str, Any]:
    body: dict[str, Any] = {'rates': payload.rates, 'allowed_variation_percent': payload.allowed_variation_percent}
    saved = save_rule_book(body)
    return _success(saved)

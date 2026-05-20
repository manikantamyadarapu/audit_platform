from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.sales_engine.services.metal_rate_store import api_response_from_stored, load_market_rates, save_market_rates

router = APIRouter(prefix='/api/rate-rules', tags=['rate-rules'])
gateway_router = APIRouter(prefix='/api/v1/rate-rules', tags=['rate-rules'])


class RateRulesPayload(BaseModel):
    gold_14k_rate: float | None = Field(default=None, alias='gold_14k_rate')
    gold_18k_rate: float | None = Field(default=None, alias='gold_18k_rate')
    gold_22k_rate: float | None = Field(default=None, alias='gold_22k_rate')
    gold_jadau_rate: float | None = Field(default=None, alias='gold_jadau_rate')
    gold_24k_rate: float | None = Field(default=None, alias='gold_24k_rate')
    silver_rate: float | None = Field(default=None, alias='silver_rate')

    model_config = {'populate_by_name': True}


def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {'success': True, **data}


@router.get('')
@gateway_router.get('')
async def get_rate_rules() -> dict[str, Any]:
    stored = load_market_rates()
    return _success(api_response_from_stored(stored))


@router.post('')
@gateway_router.post('')
async def post_rate_rules(payload: RateRulesPayload) -> dict[str, Any]:
    saved = save_market_rates(payload.model_dump(by_alias=True))
    return _success(saved)

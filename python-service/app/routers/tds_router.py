from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.engines.tds_engine.engine.tds_rule_store import api_response_from_stored, load_rule_book, save_rule_book

router = APIRouter(prefix='/api/tds-rules', tags=['tds-rules'])
gateway_router = APIRouter(prefix='/api/v1/tds-rules', tags=['tds-rules'])


class TDSRuleSpec(BaseModel):
    description: str | None = None
    threshold: str | None = None
    rate: str | None = None
    rate_individual: str | None = None
    rate_others: str | None = None
    special_rule: str | None = None


class TDSRuleBookPayload(BaseModel):
    rules: dict[str, TDSRuleSpec | dict[str, str | None]] = Field(default_factory=dict)

    model_config = {'populate_by_name': True}


def _success(data: dict[str, Any]) -> dict[str, Any]:
    return {'success': True, **data}


@router.get('')
@gateway_router.get('')
async def get_tds_rules() -> dict[str, Any]:
    stored = load_rule_book()
    return _success(api_response_from_stored(stored))


@router.post('')
@gateway_router.post('')
async def post_tds_rules(payload: TDSRuleBookPayload) -> dict[str, Any]:
    rules: dict[str, dict[str, str | None]] = {}
    for key, value in payload.rules.items():
        if isinstance(value, TDSRuleSpec):
            rules[key] = value.model_dump()
        else:
            rules[key] = value
    body: dict[str, Any] = {'rules': rules}
    saved = save_rule_book(body)
    return _success(saved)

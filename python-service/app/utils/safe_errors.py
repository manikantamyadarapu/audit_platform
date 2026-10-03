"""Client-safe error payloads (never leak exception strings on 500)."""

from __future__ import annotations

from typing import Any


INTERNAL_ERROR_DETAIL = 'Internal server error'


def internal_error_body(*, request_id: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        'success': False,
        'detail': INTERNAL_ERROR_DETAIL,
        'message': INTERNAL_ERROR_DETAIL,
    }
    if request_id:
        body['requestId'] = request_id
    return body

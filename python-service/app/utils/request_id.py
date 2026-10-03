"""Gateway request-id correlation helpers."""

from __future__ import annotations

import uuid

from fastapi import Request

REQUEST_ID_HEADER = 'x-request-id'


def resolve_request_id(request: Request | None = None) -> str:
    """
    Prefer the incoming ``x-request-id`` (Node gateway); otherwise mint a UUID.

    Used so Python logs and response bodies correlate with Express request IDs.
    """
    if request is not None:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        if incoming and str(incoming).strip():
            return str(incoming).strip()
    return str(uuid.uuid4())

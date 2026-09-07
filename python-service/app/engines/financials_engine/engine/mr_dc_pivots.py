"""Build separate MR and DC product pivots by location. No Closing Stock mapping."""

from __future__ import annotations

import re
from typing import Any

from app.engines.financials_engine.engine.calculator import build_product_pivot

PIVOT_KEYS: tuple[str, ...] = ('jubileeHills', 'kokapet', 'internalBasheerbagh')

_JUBILEE = frozenset({'jubilee hills', 'jubilee', 'jubileehills', 'jh'})
_KOKAPET = frozenset({'kokapet'})
_INTERNAL = frozenset(
    {
        'internal',
        'basheerbagh',
        'basheer bagh',
        'bashirbagh',
        'internal / basheerbagh',
        'internal/basheerbagh',
        'internal basheerbagh',
        'ist',
        'internal stock transfer',
    }
)


def _norm_place(value: Any) -> str:
    return ' '.join(str(value or '').replace('\n', ' ').replace('\r', ' ').lower().split())


def _compact(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '', value)


def _alias_hit(text: str, aliases: frozenset[str]) -> bool:
    if not text:
        return False
    compact = _compact(text)
    compact_aliases = {_compact(alias) for alias in aliases}
    if text in aliases or compact in compact_aliases:
        return True
    for alias in aliases:
        token = alias.strip()
        if len(_compact(token)) <= 3:
            continue
        if token in text or _compact(token) in compact:
            return True
    return False


def classify_mr_dc_location(branch: Any, party: Any = '') -> str | None:
    """Return jubileeHills | kokapet | internalBasheerbagh, or None if unmatched."""
    for raw in (branch, party):
        text = _norm_place(raw)
        if not text:
            continue
        if _alias_hit(text, _JUBILEE):
            return 'jubileeHills'
        if _alias_hit(text, _KOKAPET):
            return 'kokapet'
        if _alias_hit(text, _INTERNAL):
            return 'internalBasheerbagh'
    return None


def _empty_pivots() -> dict[str, list[dict[str, Any]]]:
    return {key: [] for key in PIVOT_KEYS}


def build_location_pivots(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group rows by location, then product SUM(Quantity) and SUM(Gross Amount)."""
    buckets: dict[str, list[dict[str, Any]]] = {key: [] for key in PIVOT_KEYS}
    for row in rows:
        loc = classify_mr_dc_location(row.get('branch'), row.get('party'))
        if loc is None:
            continue
        buckets[loc].append(row)
    return {key: build_product_pivot(buckets[key]) for key in PIVOT_KEYS}


def build_mr_dc_pivot_payload(
    *,
    mr_rows: list[dict[str, Any]] | None = None,
    dc_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """MR and DC stay in separate pivot trees. Never mixed."""
    return {
        'mrPivots': build_location_pivots(list(mr_rows or [])),
        'dcPivots': build_location_pivots(list(dc_rows or [])),
    }

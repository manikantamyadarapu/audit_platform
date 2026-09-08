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

_UNCLASSIFIED_SAMPLE_LIMIT = 50


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


def _unclassified_sample(row: dict[str, Any]) -> dict[str, Any]:
    return {
        'product': str(row.get('product') or '').strip(),
        'branch': str(row.get('branch') or '').strip(),
        'party': str(row.get('party') or '').strip(),
        'quantity': row.get('quantity'),
        'grossAmount': row.get('grossAmount'),
    }


def build_location_pivots_with_report(
    rows: list[dict[str, Any]] | None,
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, Any]]:
    """Group rows by location into pivots and return classification counts."""
    source_rows = list(rows or [])
    buckets: dict[str, list[dict[str, Any]]] = {key: [] for key in PIVOT_KEYS}
    unclassified_samples: list[dict[str, Any]] = []
    unclassified_count = 0

    for row in source_rows:
        loc = classify_mr_dc_location(row.get('branch'), row.get('party'))
        if loc is None:
            unclassified_count += 1
            if len(unclassified_samples) < _UNCLASSIFIED_SAMPLE_LIMIT:
                unclassified_samples.append(_unclassified_sample(row))
            continue
        buckets[loc].append(row)

    pivots = {key: build_product_pivot(buckets[key]) for key in PIVOT_KEYS}
    report = {
        'sourceRowCount': len(source_rows),
        'classifiedRowCount': len(source_rows) - unclassified_count,
        'unclassifiedCount': unclassified_count,
        'locationCounts': {key: len(buckets[key]) for key in PIVOT_KEYS},
        'unclassifiedRows': unclassified_samples,
    }
    return pivots, report


def build_location_pivots(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Group rows by location, then product SUM(Quantity) and SUM(Gross Amount)."""
    pivots, _report = build_location_pivots_with_report(rows)
    return pivots


def build_mr_dc_pivot_payload(
    *,
    mr_rows: list[dict[str, Any]] | None = None,
    dc_rows: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """MR and DC stay in separate pivot trees. Never mixed."""
    mr_pivots, mr_report = build_location_pivots_with_report(list(mr_rows or []))
    dc_pivots, dc_report = build_location_pivots_with_report(list(dc_rows or []))
    return {
        'mrPivots': mr_pivots,
        'dcPivots': dc_pivots,
        'mrReport': mr_report,
        'dcReport': dc_report,
    }

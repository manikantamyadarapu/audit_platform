"""Load configurable MR/DC → Receipts/Issues bucket classification rules."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Mapping

_CONFIG_PATH = Path(__file__).resolve().parent / 'receipts_issues_classification.json'

_UNICODE_WS = re.compile(
    r'[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+',
    re.UNICODE,
)
_NON_ALNUM = re.compile(r'[^a-z0-9]+', re.IGNORECASE)

# Template-aligned bucket keys (Receipts ≠ Issues branch labels).
RECEIPTS_BUCKET_KEYS: tuple[str, ...] = ('ist', 'jubilee', 'kokapet')
ISSUES_BUCKET_KEYS: tuple[str, ...] = ('ist', 'banjara', 'kokapet')

RECEIPTS_MEASURE_BY_BUCKET: dict[str, tuple[str, str]] = {
    'ist': ('receiptsIstQty', 'receiptsIstAmt'),
    'jubilee': ('receiptsJubileeQty', 'receiptsJubileeAmt'),
    'kokapet': ('receiptsKokapetQty', 'receiptsKokapetAmt'),
}
ISSUES_MEASURE_BY_BUCKET: dict[str, tuple[str, str]] = {
    'ist': ('issuesIstQty', 'issuesIstAmt'),
    'banjara': ('issuesBanjaraQty', 'issuesBanjaraAmt'),
    'kokapet': ('issuesKokapetQty', 'issuesKokapetAmt'),
}

RECEIPTS_TOTAL_KEYS: tuple[str, str] = ('receiptsTotalQty', 'receiptsTotalAmt')
ISSUES_TOTAL_KEYS: tuple[str, str] = ('issuesTotalQty', 'issuesTotalAmt')

RECEIPTS_ISSUES_MEASURE_KEYS: tuple[str, ...] = (
    'receiptsIstQty',
    'receiptsIstAmt',
    'receiptsJubileeQty',
    'receiptsJubileeAmt',
    'receiptsKokapetQty',
    'receiptsKokapetAmt',
    'receiptsTotalQty',
    'receiptsTotalAmt',
    'issuesIstQty',
    'issuesIstAmt',
    'issuesBanjaraQty',
    'issuesBanjaraAmt',
    'issuesKokapetQty',
    'issuesKokapetAmt',
    'issuesTotalQty',
    'issuesTotalAmt',
)


def norm_classification_text(value: Any) -> str:
    text = unicodedata.normalize('NFKC', str(value or ''))
    text = _UNICODE_WS.sub(' ', text).strip().casefold()
    return ' '.join(text.split())


def alnum_classification_key(value: Any) -> str:
    return _NON_ALNUM.sub('', norm_classification_text(value))


def load_receipts_issues_classification(
    path: Path | None = None,
) -> dict[str, Any]:
    """Load classification JSON from disk on every call (no cache)."""
    target = path or _CONFIG_PATH
    if not target.exists():
        raise FileNotFoundError(f'Receipts/Issues classification config not found: {target}')
    raw = json.loads(target.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise ValueError('Receipts/Issues classification config must be a JSON object')
    return raw


def _bucket_alias_index(
    buckets: Mapping[str, Any],
    *,
    priority: list[str],
) -> list[tuple[str, set[str]]]:
    """Return (bucket_key, alias_keys) in match priority order."""
    ordered: list[tuple[str, set[str]]] = []
    for key in priority:
        entry = buckets.get(key) or {}
        aliases = entry.get('aliases') or []
        keys: set[str] = set()
        for alias in aliases:
            n = norm_classification_text(alias)
            a = alnum_classification_key(alias)
            if n:
                keys.add(n)
            if a:
                keys.add(a)
        label = entry.get('label')
        if label:
            n = norm_classification_text(label)
            a = alnum_classification_key(label)
            if n:
                keys.add(n)
            if a:
                keys.add(a)
        ordered.append((key, keys))
    return ordered


def build_classification_matcher(
    config: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Precompute matchers for receipts and issues sides.

    Matching is deterministic substring / equality on normalized + alphanumeric
    forms — never fuzzy.
    """
    cfg = config if config is not None else load_receipts_issues_classification()
    priority = cfg.get('matchPriority') or {}
    receipts_priority = list(priority.get('receipts') or RECEIPTS_BUCKET_KEYS)
    issues_priority = list(priority.get('issues') or ISSUES_BUCKET_KEYS)
    options = dict(cfg.get('options') or {})
    include_ist = bool(options.get('includeIstInTotals', True))

    return {
        'receipts': _bucket_alias_index(
            cfg.get('receiptsBuckets') or {},
            priority=receipts_priority,
        ),
        'issues': _bucket_alias_index(
            cfg.get('issuesBuckets') or {},
            priority=issues_priority,
        ),
        'classificationColumnAliases': [
            str(a).strip().casefold().replace(' ', '_')
            for a in (cfg.get('classificationColumnAliases') or [])
            if str(a).strip()
        ],
        'includeIstInTotals': include_ist,
        'configPath': str(_CONFIG_PATH),
        'version': cfg.get('version'),
    }


def classify_transfer_text(
    text: Any,
    *,
    side: str,
    matcher: Mapping[str, Any] | None = None,
) -> str | None:
    """
    Map a classification hint to a bucket key for ``side`` ('receipts' | 'issues').

    Returns None when no configured alias matches (row stays unclassified).
    """
    index = matcher if matcher is not None else build_classification_matcher()
    buckets = index.get(side) or []
    hay_norm = norm_classification_text(text)
    hay_alnum = alnum_classification_key(text)
    if not hay_norm and not hay_alnum:
        return None

    for bucket_key, aliases in buckets:
        for alias in aliases:
            if not alias:
                continue
            # Exact normalized / alphanumeric equality, or contained phrase.
            if alias == hay_norm or alias == hay_alnum:
                return bucket_key
            if len(alias) >= 3 and (alias in hay_norm or alias in hay_alnum):
                return bucket_key
    return None

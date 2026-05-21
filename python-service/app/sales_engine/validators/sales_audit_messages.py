from __future__ import annotations

from typing import Any

MSG_VALID_RATE = 'Valid rate.'
MSG_RATE_BELOW = 'Unit rate below allowed range.'
MSG_RATE_ABOVE = 'Unit rate above allowed range.'
MSG_PRODUCT_MAPPING = 'Product mapping mismatch.'
MSG_MARKET_RATE_MISSING = 'Market rate not configured.'
MSG_UNIT_RATE_MISSING = 'Unit rate missing.'
MSG_PRODUCT_PATTERN = 'Slab price could not be extracted from product name.'

_ISSUE_DEFAULTS: dict[str, str] = {
    'INVALID_PRODUCT_MAPPING': MSG_PRODUCT_MAPPING,
    'INVALID_PRODUCT_PATTERN': MSG_PRODUCT_PATTERN,
    'INVALID_RATE_DEVIATION': MSG_RATE_BELOW,
    'UNIT_RATE_MISSING': MSG_UNIT_RATE_MISSING,
    'RATE_BELOW_MINIMUM': MSG_RATE_BELOW,
    'RATE_ABOVE_MAXIMUM': MSG_RATE_ABOVE,
}


def _rate_message_from_row(row: dict[str, Any]) -> str | None:
    if row.get('__invalid_product_mapping'):
        return MSG_PRODUCT_MAPPING
    if row.get('__invalid_product_pattern'):
        return MSG_PRODUCT_PATTERN
    if row.get('__rate_unit_missing') or row.get('__invalid_rate_no_unit'):
        return MSG_UNIT_RATE_MISSING
    if row.get('__rate_below_min'):
        return MSG_RATE_BELOW
    if row.get('__rate_above_max'):
        return MSG_RATE_ABOVE
    if row.get('__invalid_rate_deviation'):
        return MSG_RATE_BELOW
    if row.get('__rate_valid') and row.get('__metal_rate_applies'):
        return MSG_VALID_RATE
    return None


def build_row_messages(row: dict[str, Any], issues: list[str]) -> list[str]:
    """Short UTF-8 messages for API export (no +/- symbols)."""
    messages: list[str] = []
    primary = _rate_message_from_row(row)
    if primary:
        messages.append(primary)

    for code in issues:
        text = _ISSUE_DEFAULTS.get(code)
        if text and text not in messages:
            messages.append(text)

    if not messages and issues:
        messages = [_ISSUE_DEFAULTS.get(code, code) for code in issues]

    seen: set[str] = set()
    ordered: list[str] = []
    for msg in messages:
        if msg and msg not in seen:
            seen.add(msg)
            ordered.append(msg)
    return ordered


def merge_message_lists(*parts: list[str] | None) -> list[str]:
    seen: set[str] = set()
    merged: list[str] = []
    for part in parts:
        if not part:
            continue
        for msg in part:
            if msg and msg not in seen:
                seen.add(msg)
                merged.append(msg)
    return merged

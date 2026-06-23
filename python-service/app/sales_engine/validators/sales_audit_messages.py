from __future__ import annotations

from typing import Any

MSG_VALID = 'Valid'
MSG_RATE_BELOW = 'Rate below allowed range'
MSG_RATE_ABOVE = 'Rate above allowed range'
MSG_PRODUCT_MAPPING = 'Product mapping mismatch'
MSG_RATE_RULE_MISSING = 'Rate rule not configured'
MSG_UNIT_RATE_MISSING = 'Unit rate missing'
MSG_PRODUCT_PATTERN = 'Product pattern invalid'
MSG_INVALID_UOM = 'invalid UOM'
MSG_INVALID_UNIT_RATE_RANGE = 'Unit rate must be between 0 and 1 for this product.'

_ISSUE_MESSAGE: dict[str, str] = {
    'INVALID_PRODUCT_MAPPING': MSG_PRODUCT_MAPPING,
    'INVALID_PRODUCT_PATTERN': MSG_PRODUCT_PATTERN,
    'INVALID_UOM': MSG_INVALID_UOM,
    'INVALID_RATE_DEVIATION': MSG_RATE_BELOW,
    'MISSING_UNIT_RATE': MSG_UNIT_RATE_MISSING,
    'MISSING_RATE_RULE': MSG_RATE_RULE_MISSING,
    'INVALID_UNIT_RATE_RANGE': MSG_INVALID_UNIT_RATE_RANGE,
}

_ISSUE_PRIORITY: tuple[str, ...] = (
    'INVALID_PRODUCT_MAPPING',
    'INVALID_PRODUCT_PATTERN',
    'INVALID_UOM',
    'MISSING_RATE_RULE',
    'INVALID_UNIT_RATE_RANGE',
    'MISSING_UNIT_RATE',
    'INVALID_RATE_DEVIATION',
)


def _rate_direction_message(row: dict[str, Any]) -> str:
    if row.get('__rate_above_max'):
        return MSG_RATE_ABOVE
    if row.get('__rate_below_min') or row.get('__invalid_rate_deviation'):
        return MSG_RATE_BELOW
    return MSG_RATE_BELOW


def primary_audit_message(row: dict[str, Any], issues: list[str]) -> str | None:
    """One short message per row — no duplicates, no diamond/metal variants."""
    issue_set = {str(c) for c in issues if c}

    for code in _ISSUE_PRIORITY:
        if code not in issue_set:
            continue
        if code == 'INVALID_RATE_DEVIATION':
            return _rate_direction_message(row)
        return _ISSUE_MESSAGE[code]

    if row.get('__invalid_product_mapping'):
        return MSG_PRODUCT_MAPPING
    if row.get('__invalid_product_pattern'):
        return MSG_PRODUCT_PATTERN
    if row.get('__invalid_uom'):
        return MSG_INVALID_UOM
    if (row.get('__diamond_rate_expected') and not row.get('__diamond_rate_applies')) or (
        row.get('__metal_rate_expected') and not row.get('__metal_rate_applies')
    ):
        return MSG_RATE_RULE_MISSING
    if row.get('__rate_unit_missing') or row.get('__invalid_rate_no_unit'):
        return MSG_UNIT_RATE_MISSING
    if row.get('__rate_above_max'):
        return MSG_RATE_ABOVE
    if row.get('__rate_below_min') or row.get('__invalid_rate_deviation'):
        return _rate_direction_message(row)
    if row.get('__rate_valid'):
        return MSG_VALID
    return None


def build_row_messages(row: dict[str, Any], issues: list[str]) -> list[str]:
    """Return at most one clean audit message."""
    msg = primary_audit_message(row, issues)
    return [msg] if msg else []


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
    return merged[:1]


def format_messages_field(messages: list[str] | None) -> str:
    if not messages:
        return ''
    return messages[0] if messages else ''


def format_issues_as_display_messages(issues: list[str]) -> str:
    """Map issue codes to business-approved display text (never raw codes in Message)."""
    messages: list[str] = []
    for code in issues:
        if not code:
            continue
        text = _ISSUE_MESSAGE.get(code)
        if not text:
            continue
        if text not in messages:
            messages.append(text)
    return '; '.join(messages)


def format_record_issues_as_display_messages(row: dict[str, Any], issues: list[str]) -> str:
    """Business text for export — respects rate above/below when row flags are set."""
    messages: list[str] = []
    for code in issues:
        if not code:
            continue
        if code == 'INVALID_RATE_DEVIATION':
            text = _rate_direction_message(row)
        else:
            text = _ISSUE_MESSAGE.get(code)
        if not text:
            continue
        if text not in messages:
            messages.append(text)
    return '; '.join(messages)

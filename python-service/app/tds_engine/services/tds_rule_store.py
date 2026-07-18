"""TDS Rule Book storage service - mirrors metal_rate_store.py"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.tds_engine.config.tds_constants import TDS_SECTIONS

_CONFIG_DIR = Path(__file__).resolve().parents[1] / 'config'
_RULE_BOOK_PATH = _CONFIG_DIR / 'tds_rule_book.json'


def _parse_optional_rate(value: Any) -> str | None:
    """Parse rate string or return None if empty"""
    if value is None or value == '':
        return None
    return str(value).strip()


def _parse_tds_rule(raw: Any) -> dict[str, str | None]:
    """Parse TDS rule from stored format"""
    if isinstance(raw, dict):
        return {
            'description': _parse_optional_rate(raw.get('description')),
            'threshold': _parse_optional_rate(raw.get('threshold')),
            'rate': _parse_optional_rate(raw.get('rate')),
            'rate_individual': _parse_optional_rate(raw.get('rate_individual')),
            'rate_others': _parse_optional_rate(raw.get('rate_others')),
            'special_rule': _parse_optional_rate(raw.get('special_rule')),
        }
    # Handle legacy format if needed
    return {
        'description': None,
        'threshold': None,
        'rate': None,
        'rate_individual': None,
        'rate_others': None,
        'special_rule': None,
    }


def load_rule_book() -> dict[str, Any]:
    """Load TDS rule book from JSON file"""
    if not _RULE_BOOK_PATH.exists():
        return _empty_rule_book()
    return json.loads(_RULE_BOOK_PATH.read_text(encoding='utf-8'))


def _empty_rule_book() -> dict[str, Any]:
    """Return empty rule book with default TDS sections"""
    return {
        **{section['section']: section for section in TDS_SECTIONS},
        'updated_at': None,
    }


def save_rule_book(payload: dict[str, Any]) -> dict[str, Any]:
    """Persist employee-entered TDS rule book"""
    rules_in = payload.get('rules') if isinstance(payload.get('rules'), dict) else payload
    tds_rules: dict[str, dict[str, str | None]] = {}
    
    for section_def in TDS_SECTIONS:
        section_code = section_def['section']
        raw = rules_in.get(section_code) if isinstance(rules_in, dict) else payload.get(section_code)
        
        if isinstance(raw, dict):
            tds_rules[section_code] = {
                'description': _parse_optional_rate(raw.get('description', section_def['description'])),
                'threshold': _parse_optional_rate(raw.get('threshold', section_def['threshold'])),
                'rate': _parse_optional_rate(raw.get('rate', section_def['rate'])),
                'rate_individual': _parse_optional_rate(raw.get('rate_individual', section_def['rate_individual'])),
                'rate_others': _parse_optional_rate(raw.get('rate_others', section_def['rate_others'])),
                'special_rule': _parse_optional_rate(raw.get('special_rule', section_def['special_rule'])),
            }
        else:
            # Use default values if no data provided
            tds_rules[section_code] = {
                'description': section_def['description'],
                'threshold': section_def['threshold'],
                'rate': section_def['rate'],
                'rate_individual': section_def['rate_individual'],
                'rate_others': section_def['rate_others'],
                'special_rule': section_def['special_rule'],
            }

    stored = {
        **tds_rules,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    _RULE_BOOK_PATH.write_text(json.dumps(stored, indent=2), encoding='utf-8')
    return api_response_from_stored(stored)


def api_response_from_stored(stored: dict[str, Any]) -> dict[str, Any]:
    """Format stored data for API response"""
    rules: dict[str, dict[str, str | None]] = {}
    for section_def in TDS_SECTIONS:
        section_code = section_def['section']
        raw = stored.get(section_code, section_def)
        rules[section_code] = _parse_tds_rule(raw)
    
    return {
        'rules': rules,
        'updated_at': stored.get('updated_at'),
    }

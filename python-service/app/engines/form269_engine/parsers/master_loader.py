"""Load configurable master/reference data for Form 269."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.engines.form269_engine.config.constants import (
    MASTER_JSON_FIELDS,
    MASTER_REFERENCE_FILENAME,
)
from app.utils.header_cleaner import normalize_header

_MASTER_DATA_DIR = Path(__file__).resolve().parents[1] / 'data'
_DEFAULT_MASTER_PATH = _MASTER_DATA_DIR / MASTER_REFERENCE_FILENAME
_LEDGER_EXTENSIONS = ('.xlsx', '.xlsm', '.xls')


def extract_lender_name(file_name: str) -> str:
    """Derive lender/depositor name from an uploaded filename without breaking dotted names."""
    base = Path(file_name).name
    lower = base.lower()
    for ext in _LEDGER_EXTENSIONS:
        if lower.endswith(ext):
            return base[: -len(ext)].strip()
    return base.strip()


def _cell_text(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    return str(value).strip()


def _normalize_lookup_key(name: str) -> str:
    return normalize_header(name)


def _normalize_master_entry(entry: dict[str, Any]) -> dict[str, str] | None:
    name = _cell_text(entry.get('name'))
    if not name:
        return None
    return {
        'name': name,
        'address': _cell_text(entry.get('address')),
        'pan': _cell_text(entry.get('pan')),
        'aadhaar': _cell_text(entry.get('aadhaar')),
    }


def load_master_records(raw_json: str | bytes) -> dict[str, dict[str, str]]:
    """
    Load master records keyed by normalized name from JSON.

    Expected fields per record: name, address, pan, aadhaar
    """
    if isinstance(raw_json, bytes):
        raw_json = raw_json.decode('utf-8')

    data = json.loads(raw_json)
    if not isinstance(data, list):
        raise ValueError('Master JSON must be an array of records')

    records: dict[str, dict[str, str]] = {}
    for entry in data:
        if not isinstance(entry, dict):
            continue
        missing = [field for field in MASTER_JSON_FIELDS if field not in entry]
        if missing:
            raise ValueError(f'Master record missing required fields: {", ".join(missing)}')
        record = _normalize_master_entry(entry)
        if record:
            records[_normalize_lookup_key(record['name'])] = record
    return records


def resolve_master_reference_path(path: Path | None = None) -> Path:
    """Return the bundled master/reference JSON path for Form 269."""
    candidate = path or _DEFAULT_MASTER_PATH
    if not candidate.is_file():
        raise FileNotFoundError(
            f'Form 269 master reference file not found: {candidate}. '
            f'Expected JSON array with fields: {", ".join(MASTER_JSON_FIELDS)}'
        )
    return candidate


@lru_cache(maxsize=1)
def load_bundled_master_records(master_path: str | None = None) -> dict[str, dict[str, str]]:
    """Load master records from the module-bundled reference JSON file."""
    path = resolve_master_reference_path(Path(master_path) if master_path else None)
    return load_master_records(path.read_text(encoding='utf-8'))


def lookup_master_record(
    lender_name: str,
    master_records: dict[str, dict[str, str]],
) -> dict[str, str]:
    """Match lender/depositor name from filename against master data."""
    clean_name = extract_lender_name(lender_name)
    key = _normalize_lookup_key(clean_name)
    if key in master_records:
        return dict(master_records[key])

    return {
        'name': clean_name,
        'address': '',
        'pan': '',
        'aadhaar': '',
    }

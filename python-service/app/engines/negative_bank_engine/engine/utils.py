"""Utility helpers for Negative Bank Audit."""

from __future__ import annotations

import re

from app.engines.cash_ledger_engine.engine.utils import normalize_contra_account
from app.engines.negative_bank_engine.config.constants import (
    NEGATIVE_BANK_CONTRA_PHRASES,
    NEGATIVE_BANK_CONTRA_TOKENS,
)


def is_negative_bank_contra_account(contra_account: str | None) -> bool:
    """True when contra account indicates opening/closing balance style rows."""
    normalized = normalize_contra_account(contra_account)
    if not normalized:
        return False

    for phrase in NEGATIVE_BANK_CONTRA_PHRASES:
        if phrase in normalized:
            return True

    tokens = set(re.findall(r'[a-z0-9]+', normalized))
    return bool(tokens & NEGATIVE_BANK_CONTRA_TOKENS)

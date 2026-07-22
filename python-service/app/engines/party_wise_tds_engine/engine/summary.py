"""Party-wise TDS summary calculations (informational — no validation)."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.engines.cash_ledger_engine.parsers.parser import (
    is_auditable_transaction_row,
    parse_amount,
)
from app.engines.party_wise_tds_engine.config.constants import (
    SOURCE_PAYABLE,
    SOURCE_PURCHASE,
)


def build_party_tds_summary(
    rows: list[dict[str, Any]],
    *,
    source: str,
) -> list[dict[str, Any]]:
    """Group transaction rows by Contra Account and SUM(Credit)."""
    totals: dict[str, float] = defaultdict(float)

    for row in rows:
        if not is_auditable_transaction_row(row):
            continue
        contra = row.get('contra_account')
        if contra is None:
            continue
        party = str(contra).strip()
        if not party:
            continue
        credit = parse_amount(row.get('credit'))
        if credit is None:
            continue
        totals[party] += float(credit)

    summary: list[dict[str, Any]] = []
    for party in sorted(totals.keys(), key=lambda name: name.lower()):
        amount = round(totals[party], 2)
        summary.append(
            {
                'contra_account': party,
                'total_tds_amount': amount,
                'source': source,
            }
        )
    return summary


def summarize_purchase_goods(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return build_party_tds_summary(rows, source=SOURCE_PURCHASE)


def summarize_tds_payable(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return build_party_tds_summary(rows, source=SOURCE_PAYABLE)

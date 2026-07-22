"""Response builders for Party Wise TDS Summary."""

from typing import Any

from app.engines.party_wise_tds_engine.config.constants import (
    FILE_TYPE,
    TABLE_EXPORT_COLUMNS,
    TABLE_EXPORT_HEADER_MAP,
)
from app.utils.response_builder import build_processing_response


def build_party_wise_tds_response(
    *,
    purchase_summary: list[dict[str, Any]],
    payable_summary: list[dict[str, Any]],
    purchase_row_count: int,
    payable_row_count: int,
) -> dict[str, Any]:
    """Build informational response (no pass/fail / error widgets)."""
    purchase_total = round(
        sum(float(r.get('total_tds_amount') or 0) for r in purchase_summary), 2
    )
    payable_total = round(
        sum(float(r.get('total_tds_amount') or 0) for r in payable_summary), 2
    )

    records = list(purchase_summary) + list(payable_summary)
    summary = {
        'purchasePartyCount': len(purchase_summary),
        'payablePartyCount': len(payable_summary),
        'purchaseTotalTds': purchase_total,
        'payableTotalTds': payable_total,
        'purchaseRowCount': purchase_row_count,
        'payableRowCount': payable_row_count,
    }

    response = build_processing_response(
        file_type=FILE_TYPE,
        total_rows=purchase_row_count + payable_row_count,
        error_rows=0,
        summary=summary,
        records=records,
    )
    response['purchaseSummary'] = purchase_summary
    response['payableSummary'] = payable_summary
    response['exportColumns'] = list(TABLE_EXPORT_COLUMNS)
    response['columnDisplayHeaders'] = dict(TABLE_EXPORT_HEADER_MAP)
    return response

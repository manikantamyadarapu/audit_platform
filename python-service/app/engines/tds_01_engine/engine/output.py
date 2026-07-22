"""API response builder for TDS @ 0.1%."""

from typing import Any

from app.engines.tds_01_engine.config.constants import (
    FILE_TYPE,
    TABLE_EXPORT_COLUMNS,
    TABLE_EXPORT_HEADER_MAP,
)
from app.utils.response_builder import build_processing_response


def build_tds_01_response(
    *,
    detailed_rows: list[dict[str, Any]],
    summary_rows: list[dict[str, Any]],
    metrics: dict[str, Any],
) -> dict[str, Any]:
    """Build processing response with dashboard widget metrics."""
    summary = {
        'totalRecords': metrics.get('totalRecords', 0),
        'totalParties': metrics.get('totalParties', 0),
        'eligibleSuppliers': metrics.get('eligibleSuppliers', 0),
        'nonEligibleSuppliers': metrics.get('nonEligibleSuppliers', 0),
        'totalPurchaseAmount': metrics.get('totalPurchaseAmount', 0),
        'eligiblePurchaseAmount': metrics.get('eligiblePurchaseAmount', 0),
        'totalTdsDeductible': metrics.get('totalTdsDeductible', 0),
        'compliancePercent': metrics.get('compliancePercent', 0),
    }

    response = build_processing_response(
        file_type=FILE_TYPE,
        total_rows=int(summary['totalRecords']),
        error_rows=0,
        summary=summary,
        records=summary_rows,
    )
    response['detailedRecords'] = detailed_rows
    response['summaryRecords'] = summary_rows
    response['exportColumns'] = list(TABLE_EXPORT_COLUMNS)
    response['columnDisplayHeaders'] = dict(TABLE_EXPORT_HEADER_MAP)
    return response

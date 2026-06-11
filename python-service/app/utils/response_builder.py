from typing import Any


def build_processing_response(
    file_type: str,
    total_rows: int,
    error_rows: int,
    summary: dict[str, Any],
    records: list[dict[str, Any]],
    product_averages: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        'success': True,
        'fileType': file_type,
        'totalRows': total_rows,
        'errorRows': error_rows,
        'summary': summary,
        'records': records,
    }
    if product_averages is not None:
        payload['productAverages'] = product_averages
    return payload

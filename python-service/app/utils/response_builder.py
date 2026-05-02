from typing import Any


def build_processing_response(
    file_type: str,
    total_rows: int,
    error_rows: int,
    summary: dict[str, Any],
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        'success': True,
        'fileType': file_type,
        'totalRows': total_rows,
        'errorRows': error_rows,
        'summary': summary,
        'records': records,
    }

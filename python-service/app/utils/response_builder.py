from typing import Any


def build_processing_response(
    file_type: str,
    total_rows: int,
    error_rows: int,
    summary: dict[str, Any],
    records: list[dict[str, Any]],
    *,
    performance: dict[str, Any] | None = None,
    row_stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    out: dict[str, Any] = {
        'success': True,
        'fileType': file_type,
        'totalRows': total_rows,
        'errorRows': error_rows,
        'summary': summary,
        'records': records,
    }
    if performance is not None:
        out['performance'] = performance
    if row_stats is not None:
        out['rowStats'] = row_stats
    return out

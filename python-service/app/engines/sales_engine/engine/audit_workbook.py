from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pandas as pd
import polars as pl


def _trace_frame(txn: pl.DataFrame) -> pl.DataFrame:
    issues = (
        pl.when(pl.col('__invalid_product_mapping'))
        .then(pl.lit('INVALID_PRODUCT_MAPPING'))
        .otherwise(pl.lit(None))
    )
    issues = pl.concat_list(
        [
            issues,
            pl.when(pl.col('__invalid_rate_deviation'))
            .then(pl.lit('INVALID_RATE_DEVIATION'))
            .otherwise(pl.lit(None)),
        ]
    ).list.drop_nulls()

    return txn.select(
        pl.col('__source_excel_row_number').alias('rowNumber'),
        pl.col('__voucher_display').alias('voucherNo'),
        pl.col('__sales_account_text').alias('salesAccount'),
        pl.col('__product_text').alias('product'),
        pl.col('__uploaded_unit_rate').alias('unitRate'),
        pl.col('__slab_family').alias('slabFamily'),
        pl.col('__extracted_master_price').alias('masterPrice'),
        pl.col('__min_allowed_rate').alias('minAllowedRate'),
        pl.col('__max_allowed_rate').alias('maxAllowedRate'),
        pl.col('__audit_status').alias('auditStatus'),
        pl.col('__audit_reason').alias('auditReason'),
        issues.list.join(',').alias('issues'),
    )


def write_sales_audit_workbook(
    adjudicated: pl.DataFrame,
    *,
    output_path: Path,
) -> dict[str, int]:
    """Write VALID / INVALID / SKIPPED / UNKNOWN sheets (vectorized, no Python row loops)."""
    txn = adjudicated.filter(
        pl.col('__is_transaction_row') & ~pl.col('__is_blank_row') & ~pl.col('__is_repeated_header')
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if txn.is_empty():
        counts = {'validRows': 0, 'invalidRows': 0, 'skippedRows': 0, 'unknownRows': 0}
        pd.DataFrame({'note': ['No transaction rows']}).to_excel(output_path, sheet_name='SUMMARY', index=False)
        return counts

    frame = _trace_frame(txn)
    valid = frame.filter(pl.col('auditStatus') == 'VALID')
    invalid_pl = frame.filter(
        pl.col('auditStatus').is_in(['INVALID_PRODUCT_MAPPING', 'INVALID_RATE_DEVIATION'])
    )
    if not invalid_pl.is_empty():
        invalid_pl = invalid_pl.group_by('rowNumber').agg(
            pl.first('voucherNo'),
            pl.first('salesAccount'),
            pl.first('product'),
            pl.first('unitRate'),
            pl.first('slabFamily'),
            pl.first('masterPrice'),
            pl.first('minAllowedRate'),
            pl.first('maxAllowedRate'),
            pl.first('auditStatus'),
            pl.first('auditReason'),
            pl.first('issues'),
        ).sort('rowNumber')
    skipped = frame.filter(pl.col('auditStatus') == 'SKIPPED')
    unknown = frame.filter(pl.col('auditStatus') == 'UNKNOWN_PRODUCT')

    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='xlsxwriter') as writer:
        valid.to_pandas().to_excel(writer, sheet_name='VALID_ROWS', index=False)
        invalid_pl.to_pandas().to_excel(writer, sheet_name='INVALID_ROWS', index=False)
        skipped.to_pandas().to_excel(writer, sheet_name='SKIPPED_ROWS', index=False)
        unknown.to_pandas().to_excel(writer, sheet_name='UNKNOWN_ROWS', index=False)
    output_path.write_bytes(buffer.getvalue())

    invalid_row_count = (
        int(invalid_pl.select(pl.col('rowNumber').n_unique()).item()) if not invalid_pl.is_empty() else 0
    )
    return {
        'validRows': int(valid.height),
        'invalidRows': invalid_row_count,
        'skippedRows': int(skipped.height),
        'unknownRows': int(unknown.height),
    }

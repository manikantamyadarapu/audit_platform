from __future__ import annotations

from pathlib import Path

import polars as pl

_DEBUG_EXPORT_COLUMNS = [
    '__source_row_id',
    '__source_excel_row_number',
    '__normalized_sales_account',
    '__normalized_product',
    '__detected_category',
    '__account_category',
    '__slab_family',
    '__mapping_validation_result',
    '__mapping_valid',
    '__price_extracted',
    '__unit_rate_numeric',
    '__rate_validation_result',
    '__final_issue',
    '__drop_reason',
    '__invalid_product_mapping',
    '__invalid_product_pattern',
    '__invalid_rate_deviation',
    '__voucher_display',
    'voucher_no',
    'sales_account',
    'product',
    'unit_rate',
    'quantity',
]


def attach_debug_identity_columns(dataframe: pl.DataFrame) -> pl.DataFrame:
    return dataframe.with_columns(
        [
            pl.col('__source_excel_row_number').alias('__source_row_id'),
            pl.col('__sales_account_norm').alias('__normalized_sales_account'),
            pl.col('__product_norm').alias('__normalized_product'),
            pl.col('__extracted_master_price').alias('__price_extracted'),
            pl.col('__uploaded_unit_rate').alias('__unit_rate_numeric'),
            pl.when(pl.col('__mapping_valid'))
            .then(pl.lit('PASS'))
            .otherwise(pl.lit('FAIL'))
            .alias('__mapping_validation_result'),
        ]
    )


def write_sales_audit_debug_workbook(dataframe: pl.DataFrame, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    export_cols = [c for c in _DEBUG_EXPORT_COLUMNS if c in dataframe.columns]
    extra = [c for c in dataframe.columns if c not in export_cols and not c.startswith('__raw')]
    try:
        import pandas as pd

        dataframe.select(export_cols + extra).to_pandas().to_excel(output_path, index=False, sheet_name='ALL_ROWS')
    except ImportError:
        dataframe.select(export_cols + extra).write_csv(output_path.with_suffix('.csv'))

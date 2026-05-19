from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import polars as pl

from app.utils.logger import get_logger


@dataclass(frozen=True, slots=True)
class AuditReconciliation:
    total_input_rows: int
    total_output_rows: int
    total_invalid_rows: int
    total_valid_rows: int
    total_dropped_rows: int
    invalid_product_mapping: int
    invalid_rate_deviation: int
    invalid_product_pattern: int

    def to_dict(self) -> dict[str, int]:
        return {
            'totalInputRows': self.total_input_rows,
            'totalOutputRows': self.total_output_rows,
            'totalInvalidRows': self.total_invalid_rows,
            'totalValidRows': self.total_valid_rows,
            'totalDroppedRows': self.total_dropped_rows,
            'invalidProductMappings': self.invalid_product_mapping,
            'rateDeviationViolations': self.invalid_rate_deviation,
            'invalidProductPatterns': self.invalid_product_pattern,
        }


def _txn_mask(dataframe: pl.DataFrame) -> pl.Expr:
    return (
        pl.col('__is_transaction_row').fill_null(False)
        & ~pl.col('__is_blank_row').fill_null(False)
        & ~pl.col('__is_repeated_header').fill_null(False)
    )


def _invalid_mask(dataframe: pl.DataFrame) -> pl.Expr:
    return (
        pl.col('__invalid_product_mapping').fill_null(False)
        | pl.col('__invalid_product_pattern').fill_null(False)
        | pl.col('__invalid_rate_deviation').fill_null(False)
    )


def reconcile_adjudicated_frame(dataframe: pl.DataFrame) -> AuditReconciliation:
    total_input = int(dataframe.height)
    total_output = total_input
    txn = _txn_mask(dataframe)
    invalid = txn & _invalid_mask(dataframe)
    valid = txn & ~_invalid_mask(dataframe)
    dropped = ~txn

    total_invalid = int(dataframe.filter(invalid).height)
    total_valid = int(dataframe.filter(valid).height)
    total_dropped = int(dataframe.filter(dropped).height)

    if total_valid + total_invalid + total_dropped != total_input:
        raise AssertionError(
            'Row reconciliation failed: valid({valid}) + invalid({invalid}) + dropped({dropped}) '
            '!= input({input})'.format(
                valid=total_valid,
                invalid=total_invalid,
                dropped=total_dropped,
                input=total_input,
            )
        )

    txn_df = dataframe.filter(txn)
    mapping = _issue_row_count(txn_df, '__invalid_product_mapping')
    rate = _issue_row_count(txn_df, '__invalid_rate_deviation')
    pattern = _issue_row_count(txn_df, '__invalid_product_pattern')

    return AuditReconciliation(
        total_input_rows=total_input,
        total_output_rows=total_output,
        total_invalid_rows=total_invalid,
        total_valid_rows=total_valid,
        total_dropped_rows=total_dropped,
        invalid_product_mapping=mapping,
        invalid_rate_deviation=rate,
        invalid_product_pattern=pattern,
    )


def log_reconciliation(reconciliation: AuditReconciliation, *, logger: Any | None = None) -> None:
    log = logger or get_logger()
    payload = reconciliation.to_dict()
    log.info(
        '[sales] reconciliation TOTAL_INPUT_ROWS={totalInputRows} TOTAL_OUTPUT_ROWS={totalOutputRows} '
        'TOTAL_INVALID_ROWS={totalInvalidRows} TOTAL_VALID_ROWS={totalValidRows} '
        'TOTAL_DROPPED_ROWS={totalDroppedRows}'.format(**payload)
    )
    log.info(
        '[sales] reconciliation by issue: INVALID_PRODUCT_MAPPING={invalidProductMappings} '
        'INVALID_RATE_DEVIATION={rateDeviationViolations} INVALID_PRODUCT_PATTERN={invalidProductPatterns}'.format(
            **payload
        )
    )


def _issue_row_count(dataframe: pl.DataFrame, flag_column: str) -> int:
    return int(dataframe.filter(pl.col(flag_column).fill_null(False)).height)

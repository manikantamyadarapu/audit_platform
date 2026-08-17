import polars as pl

from app.engines.sales_engine.engine.reconciliation import reconcile_adjudicated_frame


def test_reconciliation_assertion_passes_for_partitioned_rows() -> None:
    frame = pl.DataFrame(
        {
            '__source_row_id': [1, 2, 3, 4],
            '__is_transaction_row': [True, True, False, True],
            '__is_blank_row': [False, False, True, False],
            '__is_repeated_header': [False, False, False, False],
            '__invalid_product_mapping': [True, False, False, False],
            '__invalid_product_pattern': [False, False, False, False],
            '__invalid_rate_deviation': [False, True, False, False],
        }
    )
    recon = reconcile_adjudicated_frame(frame)
    assert recon.total_input_rows == 4
    assert recon.total_invalid_rows == 2
    assert recon.total_valid_rows == 1
    assert recon.total_dropped_rows == 1
    assert recon.invalid_product_mapping == 1
    assert recon.invalid_rate_deviation == 1

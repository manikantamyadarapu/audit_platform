from io import BytesIO

import pandas as pd

from app.processors.gross_weight_processor import GrossWeightProcessor


def _build_excel_bytes(rows: list[dict]) -> bytes:
    dataframe = pd.DataFrame(rows)
    output = BytesIO()
    dataframe.to_excel(output, index=False)
    return output.getvalue()


def test_matching_positive_weights_pass() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V1',
                'Manual Gross Weight': 10.5,
                'Auto Gross Weight': 10.5,
                'Difference': 0.0,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['totalRows'] == 1
    assert result['errorRows'] == 0
    assert result['summary']['mismatchCount'] == 0
    assert result['summary']['differenceViolations'] == 0
    assert result['summary']['negativeValueViolations'] == 0
    assert result['summary']['weightMismatch'] == 0


def test_tiny_manual_auto_mismatch_within_cent_flags_when_above_epsilon() -> None:
    """Computed |manual - auto| above match epsilon (0.005) flags a mismatch."""
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V1',
                'Manual Gross Weight': 10.52,
                'Auto Gross Weight': 10.5,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['totalRows'] == 1
    assert result['errorRows'] == 1
    assert result['summary']['mismatchCount'] == 1
    assert result['summary']['weightMismatch'] == 1
    assert result['records'][0]['issues'] == ['GROSS_WEIGHT_MISMATCH']


def test_manual_auto_within_epsilon_passes() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V1',
                'Manual Gross Weight': 10.5,
                'Auto Gross Weight': 10.5004,
                'Difference': 0.0,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['totalRows'] == 1
    assert result['errorRows'] == 0


def test_manual_auto_mismatch_counts_mismatch_only() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V1',
                'Manual Gross Weight': 10.5,
                'Auto Gross Weight': 10.9,
                'Difference': 0.4,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['totalRows'] == 1
    assert result['errorRows'] == 1
    assert result['summary']['mismatchCount'] == 1
    assert result['summary']['positiveInvalidCount'] == 1
    assert result['summary']['differenceViolations'] == 0
    assert result['summary']['negativeValueViolations'] == 0
    assert result['records'][0]['issues'] == ['GROSS_WEIGHT_MISMATCH']


def test_equal_manual_auto_but_nonzero_difference_column() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V1',
                'Manual Gross Weight': 10.5,
                'Auto Gross Weight': 10.5,
                'Difference': 0.02,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['errorRows'] == 1
    assert result['summary']['mismatchCount'] == 1
    assert result['records'][0]['issues'] == ['GROSS_WEIGHT_MISMATCH']


def test_negative_equal_pair_is_reported_as_mismatch() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V1',
                'Manual Gross Weight': -5.0,
                'Auto Gross Weight': -5.0,
                'Difference': -0.01,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['totalRows'] == 1
    assert result['errorRows'] == 1
    assert result['summary']['negativeValueViolations'] == 1
    assert result['summary']['weightMismatch'] == 1
    assert result['records'][0]['issues'] == ['GROSS_WEIGHT_MISMATCH']


def test_negative_difference_triggers_negative_bucket() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V1',
                'Manual Gross Weight': 10.5,
                'Auto Gross Weight': 10.5,
                'Difference': -0.02,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['summary']['negativeValueViolations'] == 1


def test_missing_voucher_row_skipped() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': '',
                'Manual Gross Weight': 10.0,
                'Auto Gross Weight': 11.0,
            }
        ]
    )
    result = processor.process(file_bytes)
    assert result['totalRows'] == 1
    assert result['errorRows'] == 1


def test_invalid_record_excludes_internal_columns_and_orders_output() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'SNo': 1,
                'Date': '2024-01-01',
                'Party': 'Acme',
                'Voucher No': 'V1',
                'Manual Gross Weight': 10.5,
                'Auto Gross Weight': 10.9,
                'Difference': 0.4,
            }
        ]
    )
    result = processor.process(file_bytes)
    record = result['records'][0]
    assert 'date' not in record
    assert 'party' not in record
    assert 'sno' not in record
    assert 'valueRowIndex' not in record
    assert 'voucherRowIndex' not in record
    assert record['rowNumber'] == 1
    assert record['Message'] == 'Manual gross weight does not match auto gross weight.'
    assert list(record.keys())[:6] == [
        'rowNumber',
        'voucherNo',
        'manualGrossWeight',
        'autoGrossWeight',
        'difference',
        'Message',
    ]


def test_weight_summary_aliases_weight_mismatch_total() -> None:
    processor = GrossWeightProcessor()
    file_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'A',
                'Manual Gross Weight': 1,
                'Auto Gross Weight': 2,
            },
            {
                'Voucher No': 'B',
                'Manual Gross Weight': -1,
                'Auto Gross Weight': -1,
                'Difference': -0.01,
            },
        ]
    )
    result = processor.process(file_bytes)
    assert result['summary']['weightMismatch'] == result['errorRows'] == 2

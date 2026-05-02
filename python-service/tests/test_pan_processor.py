from io import BytesIO

import pandas as pd
import pytest
from openpyxl import Workbook

from app.processors.pan_processor import PanProcessor


def _build_excel_bytes(rows: list[dict]) -> bytes:
    dataframe = pd.DataFrame(rows)
    output = BytesIO()
    dataframe.to_excel(output, index=False)
    return output.getvalue()


def _build_excel_with_title_rows() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(['Sales Report - PAN & Address'])
    sheet.append(['From 01/04/2025 To 30/04/2025'])
    sheet.append([])
    sheet.append(
        [
            'SNo',
            'Date',
            'Voucher No',
            'Party',
            'Gross Amount',
            'CGST',
            'SGST',
            'IGST',
            'Total Value',
            'PAN',
            'PAN1',
            'Add. proof',
            'Add. Proof 2',
        ]
    )
    sheet.append(
        [
            77,
            '03-04-2025',
            'JH/B/2526/1',
            'Kundan Crafts Private Limited',
            '1,82,42,718.00',
            '2,73,640.77',
            '2,73,640.77',
            '0',
            '1,87,90,000.00',
            '',
            '',
            '',
            '',
        ]
    )
    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


def _base_row(**overrides):
    row = {
        'SNo': 1,
        'Date': '03-04-2025',
        'Voucher No': 'JH/B/2526/1',
        'Party': 'Kundan Crafts Private Limited',
        'Gross Amount': 1000,
        'CGST': 0,
        'SGST': 0,
        'IGST': 0,
        'Total Value': 10000,
        'PAN': '',
        'PAN1': '',
        'Add. proof': '',
        'Add. Proof 2': '',
    }
    row.update(overrides)
    return row


def test_above_2_lakh_without_pan_flags_missing_pan():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': '2,50,000.00',
                    'PAN': '',
                    'PAN1': '',
                    'Add. proof': 'Electricity Bill',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['summary']['missingPanAbove2L'] == 1
    assert 'missingPan1Above2L' not in result['summary']
    assert set(result['records'][0]['issues']) == {'MISSING_PAN_ABOVE_2L'}


def test_above_2_lakh_blank_pan_valid_pan1_passes():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 300000,
                    'PAN': '',
                    'PAN1': 'ABCDE1234F',
                    'Add. proof': 'Lease Agreement',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 0
    assert result['summary']['missingPanAbove2L'] == 0
    assert result['summary']['invalidPanFormat'] == 0
    assert result['records'] == []


def test_above_50k_without_address_proof_flags_issue():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 51000,
                    'PAN': 'ABCDE1234F',
                    'PAN1': '',
                    'Add. proof': '',
                    'Add. Proof 2': '',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['summary']['missingAddressProofAbove50K'] == 1
    assert result['records'][0]['issues'] == ['MISSING_ADDRESS_PROOF_ABOVE_50K']


def test_pan_pending_treated_empty_and_flags_missing_pan():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 250000,
                    'PAN': 'PENDING',
                    'PAN1': 'na',
                    'Add. proof': 'Ration Card',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['summary']['missingPanAbove2L'] == 1
    assert result['records'][0]['issues'] == ['MISSING_PAN_ABOVE_2L']


def test_invalid_pan_format_is_flagged():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [_base_row(**{'Total Value': 75000, 'PAN': 'AB123', 'Add. proof': 'Passport'})]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['summary']['invalidPanFormat'] == 1
    assert result['records'][0]['issues'] == ['INVALID_PAN_FORMAT']


def test_valid_row_has_no_issues():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 275000,
                    'PAN': 'ABCDE1234F',
                    'PAN1': 'PQRST6789L',
                    'Add. proof': 'Aadhaar',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 0
    assert result['records'] == []


def test_amount_with_commas_is_parsed_and_exposed():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': '1,87,90,000.00',
                    'PAN': '',
                    'PAN1': '',
                    'Add. proof': '',
                    'Add. Proof 2': '',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['records'][0]['totalValue'] == 18790000
    assert set(result['records'][0]['issues']) == {
        'MISSING_PAN_ABOVE_2L',
        'MISSING_ADDRESS_PROOF_ABOVE_50K',
    }


def test_improper_pan1_format_is_flagged_even_when_pan_blank():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [_base_row(**{'Total Value': 275000, 'PAN': '', 'PAN1': 'ab123', 'Add. proof': 'Aadhaar'})]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['summary']['invalidPanFormat'] == 1
    assert result['records'][0]['issues'] == ['INVALID_PAN_FORMAT']


def test_improper_empty_tokens_are_treated_as_missing():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 275000,
                    'PAN': '----',
                    'PAN1': '-',
                    'Add. proof': '   ',
                    'Add. Proof 2': '',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert set(result['records'][0]['issues']) == {
        'MISSING_PAN_ABOVE_2L',
        'MISSING_ADDRESS_PROOF_ABOVE_50K',
    }


def test_amount_with_currency_symbol_is_parsed():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [_base_row(**{'Total Value': 'Rs. 2,10,000.00', 'PAN': '', 'PAN1': 'none', 'Add. proof': 'Bill'})]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['records'][0]['totalValue'] == 210000
    assert result['records'][0]['issues'] == ['MISSING_PAN_ABOVE_2L']


def test_missing_total_value_column_raises_key_error():
    processor = PanProcessor()
    rows = [
        {
            'SNo': 1,
            'PAN': 'ABCDE1234F',
            'PAN1': '',
            'Add. proof': 'Aadhaar',
            'Add. Proof 2': '',
        }
    ]
    file_bytes = _build_excel_bytes(rows)

    with pytest.raises(KeyError):
        processor.process(file_bytes)


def test_above_2_lakh_valid_pan_blank_pan1_passes():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [_base_row(**{'Total Value': 225000, 'PAN': 'ABCDE1234F', 'PAN1': '', 'Add. proof': 'Aadhaar'})]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 0
    assert result['records'] == []


def test_blank_row_is_ignored_from_error_records():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': '',
                    'PAN': '',
                    'PAN1': '',
                    'Add. proof': '',
                    'Add. Proof 2': '',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['totalRows'] == 1
    assert result['errorRows'] == 0
    assert result['records'] == []


def test_above_50k_with_add_proof_2_only_should_pass_address_rule():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 60000,
                    'PAN': 'ABCDE1234F',
                    'PAN1': 'PQRST6789L',
                    'Add. proof': '',
                    'Add. Proof 2': 'Rental Agreement',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 0
    assert result['summary']['missingAddressProofAbove50K'] == 0


def test_above_2_lakh_with_pan_and_pan1_both_missing_and_no_address():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 325000,
                    'PAN': '',
                    'PAN1': '',
                    'Add. proof': '',
                    'Add. Proof 2': '',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['summary']['missingPanAbove2L'] == 1
    assert result['summary']['missingAddressProofAbove50K'] == 1
    assert set(result['records'][0]['issues']) == {
        'MISSING_PAN_ABOVE_2L',
        'MISSING_ADDRESS_PROOF_ABOVE_50K',
    }


@pytest.mark.parametrize(
    'pan_value,pan1_value',
    [
        ('ABCDE1234F', 'PQRST6789L'),
        ('abcde1234f', 'pqrst6789l'),
    ],
)
def test_valid_pan_and_pan1_formats_pass_without_errors(pan_value, pan1_value):
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 250000,
                    'PAN': pan_value,
                    'PAN1': pan1_value,
                    'Add. proof': 'Aadhaar',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 0
    assert result['summary']['invalidPanFormat'] == 0


def test_above_2_lakh_invalid_pan_rescued_by_valid_pan1():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 260000,
                    'PAN': 'ABCDE123',
                    'PAN1': 'PQRST6789L',
                    'Add. proof': 'Bill',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 0
    assert result['summary']['invalidPanFormat'] == 0


@pytest.mark.parametrize(
    'pan_value,pan1_value',
    [
        ('ABCDE1234', 'PQRST67890'),
        ('AB123', ''),
        ('123451234F', 'badpan'),
    ],
)
def test_invalid_pan_or_pan1_formats_are_detected(pan_value, pan1_value):
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 250000,
                    'PAN': pan_value,
                    'PAN1': pan1_value,
                    'Add. proof': 'Aadhaar',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['summary']['invalidPanFormat'] == 1
    assert result['records'][0]['issues'] == ['INVALID_PAN_FORMAT']


def test_threshold_values_avoid_false_positive_flags():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 200000,
                    'PAN': '',
                    'PAN1': '',
                    'Add. proof': 'Aadhaar',
                }
            ),
            _base_row(
                **{
                    'SNo': 2,
                    'Total Value': 50000,
                    'PAN': 'ABCDE1234F',
                    'PAN1': 'PQRST6789L',
                    'Add. proof': '',
                    'Add. Proof 2': '',
                }
            ),
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 0
    assert result['records'] == []


def test_pending_tokens_are_treated_as_missing_for_pan_fields():
    processor = PanProcessor()
    file_bytes = _build_excel_bytes(
        [
            _base_row(
                **{
                    'Total Value': 260000,
                    'PAN': 'pending',
                    'PAN1': 'N/A',
                    'Add. proof': 'Utility Bill',
                }
            )
        ]
    )

    result = processor.process(file_bytes)

    assert result['errorRows'] == 1
    assert result['records'][0]['issues'] == ['MISSING_PAN_ABOVE_2L']


def test_detects_header_row_when_title_rows_exist():
    processor = PanProcessor()
    file_bytes = _build_excel_with_title_rows()

    result = processor.process(file_bytes)

    assert result['totalRows'] == 1
    assert result['errorRows'] == 1
    assert result['records'][0]['rowNumber'] == 5
    assert set(result['records'][0]['issues']) == {
        'MISSING_PAN_ABOVE_2L',
        'MISSING_ADDRESS_PROOF_ABOVE_50K',
    }

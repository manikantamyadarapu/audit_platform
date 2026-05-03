from io import BytesIO
from typing import Any

import pandas as pd


PAN_EXPORT_COLUMNS = [
    'rowNumber',
    'date',
    'voucherNo',
    'party',
    'totalValue',
    'pan',
    'pan1',
    'addProof',
    'addProof2',
    'issues',
]

GROSS_WEIGHT_EXPORT_COLUMNS = [
    'voucherNo',
    'manualGross',
    'autoGross',
    'difference',
    'status',
    'issues',
]


def export_invalid_pan_records(records: list[dict[str, Any]]) -> bytes:
    if not records:
        raise ValueError('No invalid records found to export')

    dataframe = pd.DataFrame(records).copy()

    for column in PAN_EXPORT_COLUMNS:
        if column not in dataframe.columns:
            dataframe[column] = ''

    dataframe['issues'] = dataframe['issues'].apply(_stringify_issues)
    dataframe = dataframe[PAN_EXPORT_COLUMNS]

    output = BytesIO()
    dataframe.to_excel(output, index=False, sheet_name='Invalid PAN Rows')
    output.seek(0)
    return output.read()


def export_invalid_gross_weight_records(records: list[dict[str, Any]]) -> bytes:
    if not records:
        raise ValueError('No invalid records found to export')

    dataframe = pd.DataFrame(records).copy()

    for column in GROSS_WEIGHT_EXPORT_COLUMNS:
        if column not in dataframe.columns:
            dataframe[column] = ''

    dataframe['issues'] = dataframe['issues'].apply(_stringify_issues)
    dataframe = dataframe[GROSS_WEIGHT_EXPORT_COLUMNS]

    output = BytesIO()
    dataframe.to_excel(output, index=False, sheet_name='Invalid gross weight rows')
    output.seek(0)
    return output.read()


def _stringify_issues(value: Any) -> str:
    if isinstance(value, list):
        return ', '.join(str(item) for item in value)
    if value is None:
        return ''
    return str(value)

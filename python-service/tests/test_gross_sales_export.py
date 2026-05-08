from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app

client = TestClient(app)


def test_export_gross_weight_invalid_rows() -> None:
    payload = {
        'records': [
            {
                'rowNumber': 5,
                'manualGrossWeight': 10.5,
                'autoGrossWeight': 11.0,
                'difference': 0.5,
                'issues': ['GROSS_WEIGHT_MISMATCH'],
                'messages': ['Manual gross weight does not match auto gross weight.'],
            }
        ]
    }
    response = client.post('/api/process/gross-weight/export-invalid', json=payload)
    assert response.status_code == 200
    workbook = load_workbook(BytesIO(response.content))
    sheet = workbook['Invalid Gross Weight Rows']
    headers = [cell.value for cell in sheet[1]]
    assert 'manualGrossWeight' in headers
    assert 'messages' in headers


def test_export_sales_invalid_rows() -> None:
    payload = {
        'records': [
            {
                'rowNumber': 2,
                'voucherNo': 'V1',
                'salesAccount': 'Sales A',
                'product': 'Prod',
                'expectedSalesAccountCategory': 'cat_a',
                'predictedCategory': 'cat_b',
                'usedFuzzyClassification': False,
                'manualGrossWt': 1,
                'autoGrossWt': 2,
                'issues': ['PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT'],
                'messages': ['Product category does not match the category implied by the sales account.'],
            }
        ]
    }
    response = client.post('/api/process/sales/export-invalid', json=payload)
    assert response.status_code == 200
    workbook = load_workbook(BytesIO(response.content))
    sheet = workbook['Invalid Sales Rows']
    headers = [cell.value for cell in sheet[1]]
    assert 'salesAccount' in headers
    assert 'messages' in headers

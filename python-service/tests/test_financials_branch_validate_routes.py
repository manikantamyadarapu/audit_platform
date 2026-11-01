"""Branch validate routes keep the existing processors and pin the branch."""

import json
from io import BytesIO

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.main import app
from app.routers import financials_router

client = TestClient(app)

XLSX = (
    'book.xlsx',
    b'not-empty',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
)


def _post_paths() -> set[str]:
    schema = app.openapi()
    return {
        path
        for path, operations in schema['paths'].items()
        if 'post' in operations
    }


def test_download_routes_are_split_by_branch() -> None:
    paths = _post_paths()
    assert '/api/v1/process/financials/export-pivots' not in paths
    assert '/api/process/financials/export-pivots' not in paths
    assert '/api/v1/process/financials/export-closing-stock' not in paths
    assert '/api/process/financials/export-closing-stock' not in paths
    for branch in ('basheerbagh', 'kokapet'):
        assert f'/api/v1/process/financials/export-pivots/{branch}' in paths
        assert f'/api/process/financials/export-pivots/{branch}' in paths
        assert f'/api/v1/process/financials/export-closing-stock/{branch}' in paths
        assert f'/api/process/financials/export-closing-stock/{branch}' in paths
    assert '/api/v1/process/financials/jubilee-hills/template' in paths
    assert '/api/process/financials/jubilee-hills/template' in paths
    assert '/api/v1/process/financials/consolidated/template' in paths
    assert '/api/process/financials/consolidated/template' in paths


def test_branch_download_routes_reuse_existing_exporters(monkeypatch) -> None:
    calls: list[str] = []

    async def fake_pivots(request, payload):
        calls.append('pivots')
        return {'kind': 'pivots', 'sales': len(payload.salesPivot)}

    async def fake_closing(request, payload):
        calls.append('closing')
        return {'kind': 'closing', 'sales': len(payload.salesPivot)}

    monkeypatch.setattr(financials_router, 'export_financials_pivots', fake_pivots)
    monkeypatch.setattr(financials_router, 'export_closing_stock_template', fake_closing)

    pivots = client.post(
        '/api/v1/process/financials/export-pivots/kokapet',
        json={'salesPivot': [{'product': 'A'}], 'purchasesPivot': []},
    )
    closing = client.post(
        '/api/process/financials/export-closing-stock/basheerbagh',
        json={'salesPivot': [{'product': 'A'}]},
    )
    assert pivots.status_code == 200
    assert pivots.json()['kind'] == 'pivots'
    assert closing.status_code == 200
    assert closing.json()['kind'] == 'closing'
    assert calls == ['pivots', 'closing']


def _xlsx_snapshot(content: bytes) -> tuple[list[str], list[tuple]]:
    workbook = load_workbook(BytesIO(content), data_only=False)
    snapshot = []
    for name in workbook.sheetnames:
        sheet = workbook[name]
        snapshot.append(
            (
                name,
                tuple(
                    tuple(cell.value for cell in row)
                    for row in sheet.iter_rows(max_row=min(sheet.max_row or 1, 12), max_col=6)
                ),
            )
        )
    names = list(workbook.sheetnames)
    workbook.close()
    return names, snapshot


def test_each_download_endpoint_returns_the_existing_workbook() -> None:
    pivots = {
        'salesPivot': [{'product': 'Gold Ring', 'sumOfQuantity': 2, 'sumOfGross': 20000}],
        'purchasesPivot': [{'product': 'Gold Chain', 'sumOfQuantity': 3, 'sumOfGross': 15000}],
        'openingPivot': [{'product': 'Gold Ring', 'sumOfQuantity': 1, 'sumOfGross': 9000}],
    }
    pivot_books: dict[str, tuple] = {}
    for branch in ('basheerbagh', 'kokapet'):
        response = client.post(f'/api/v1/process/financials/export-pivots/{branch}', json=pivots)
        assert response.status_code == 200, response.text
        assert 'spreadsheetml.sheet' in response.headers['content-type']
        assert response.content[:2] == b'PK'
        workbook = load_workbook(BytesIO(response.content))
        assert workbook.sheetnames == ['Sales Pivot', 'Purchases Pivot']
        assert workbook['Sales Pivot']['A2'].value == 'Gold Ring'
        assert workbook['Sales Pivot']['B2'].value == 2
        assert workbook['Purchases Pivot']['A2'].value == 'Gold Chain'
        assert workbook['Purchases Pivot']['C2'].value == 15000
        workbook.close()
        pivot_books[branch] = _xlsx_snapshot(response.content)

    assert pivot_books['basheerbagh'] == pivot_books['kokapet']

    closing_books: dict[str, tuple] = {}
    for branch in ('basheerbagh', 'kokapet'):
        response = client.post(
            f'/api/process/financials/export-closing-stock/{branch}',
            json={**pivots, 'companyName': 'Sample Jewellers', 'financialYear': 'AY 2025-26'},
        )
        assert response.status_code == 200, response.text
        assert response.content[:2] == b'PK'
        names, snapshot = _xlsx_snapshot(response.content)
        assert names[:5] == [
            'Diamond',
            'Emerald',
            'Pearls',
            'Rubie',
            'Precious and Semi Precious',
        ]
        assert names[-2:] == ['Trading', 'Abstract']
        closing_books[branch] = (names, snapshot)

    assert closing_books['basheerbagh'] == closing_books['kokapet']

    jubilee = client.post(
        '/api/v1/process/financials/jubilee-hills/template',
        json={'companyName': 'Sample Jewellers', 'financialYear': 'AY 2025-26'},
    )
    assert jubilee.status_code == 200, jubilee.text
    assert jubilee.content[:2] == b'PK'
    assert 'Jubilee-Hills-Financials-' in jubilee.headers['content-disposition']
    jubilee_names, _jubilee_rows = _xlsx_snapshot(jubilee.content)
    assert jubilee_names[-2:] == ['Trading', 'Abstract']

    consolidated = client.post('/api/v1/process/financials/consolidated/template')
    assert consolidated.status_code == 200, consolidated.text
    assert consolidated.content[:2] == b'PK'
    assert 'Consolidated-Financials-' in consolidated.headers['content-disposition']
    consolidated_names, _consolidated_rows = _xlsx_snapshot(consolidated.content)
    assert consolidated_names == ['Abstract', 'TShape']

    removed = client.post('/api/v1/process/financials/export-pivots', json=pivots)
    assert removed.status_code == 404
    removed_closing = client.post('/api/v1/process/financials/export-closing-stock', json=pivots)
    assert removed_closing.status_code == 404


def test_validate_routes_are_split_by_branch() -> None:
    paths = _post_paths()
    assert '/api/v1/process/financials/validate' not in paths
    assert '/api/process/financials' not in paths
    assert '/api/v1/process/financials/validate/basheerbagh' in paths
    assert '/api/v1/process/financials/validate/kokapet' in paths
    assert '/api/v1/process/financials/validate/jubilee-hills' in paths
    assert '/api/process/financials/basheerbagh' in paths
    assert '/api/process/financials/kokapet' in paths
    assert '/api/process/financials/jubilee-hills' in paths


def test_each_branch_validate_route_is_registered() -> None:
    for path in (
        '/api/v1/process/financials/validate/basheerbagh',
        '/api/v1/process/financials/validate/kokapet',
        '/api/v1/process/financials/validate/jubilee-hills',
    ):
        response = client.post(path)
        assert response.status_code == 422, path


def test_basheerbagh_and_kokapet_pin_destination_branch(monkeypatch) -> None:
    seen: dict[str, str] = {}

    def fake_process(*_args, **kwargs):
        seen['destination_branch'] = kwargs.get('destination_branch')
        return {'success': True}

    monkeypatch.setattr(financials_router.processor, 'process', fake_process)
    files = {
        'sales_file': XLSX,
        'purchases_file': XLSX,
        'opening_qty_file': XLSX,
        'previous_year_file': XLSX,
        'mr_file': XLSX,
        'dc_file': XLSX,
    }

    basheerbagh = client.post('/api/v1/process/financials/validate/basheerbagh', files=files)
    assert basheerbagh.status_code == 200
    assert seen['destination_branch'] == 'basheerbagh'

    kokapet = client.post('/api/process/financials/kokapet', files=files)
    assert kokapet.status_code == 200
    assert seen['destination_branch'] == 'kokapet'


def test_jubilee_hills_validate_uses_existing_jubilee_processor(monkeypatch) -> None:
    called = {'count': 0}

    def fake_jubilee(*_args, **_kwargs):
        called['count'] += 1
        return {'success': True}

    monkeypatch.setattr(financials_router.processor, 'process_jubilee_hills', fake_jubilee)
    files = {
        name: XLSX
        for name in (
            'sales_file',
            'purchases_file',
            'opening_qty_file',
            'previous_year_file',
            'sales_return_file',
            'purchase_return_file',
            'credit_note_file',
            'debit_note_file',
        )
    }

    response = client.post('/api/v1/process/financials/validate/jubilee-hills', files=files)
    assert response.status_code == 200
    assert called['count'] == 1
    assert response.json()['success'] is True


def test_jubilee_hills_process_forwards_receipt_rate_mappings(monkeypatch) -> None:
    seen: dict[str, object] = {}

    def fake_jubilee(*_args, **kwargs):
        seen['receipt_rate_mappings'] = kwargs.get('receipt_rate_mappings')
        return {'success': True}

    monkeypatch.setattr(financials_router.processor, 'process_jubilee_hills', fake_jubilee)
    files = {
        name: XLSX
        for name in (
            'sales_file',
            'purchases_file',
            'opening_qty_file',
            'previous_year_file',
            'sales_return_file',
            'purchase_return_file',
            'credit_note_file',
            'debit_note_file',
        )
    }
    mappings = [{'product': 'Di. RA 10', 'sourceProduct': 'Di RA 10'}]
    response = client.post(
        '/api/process/financials/jubilee-hills',
        files=files,
        data={'receipt_rate_mappings': json.dumps(mappings)},
    )
    assert response.status_code == 200
    assert seen['receipt_rate_mappings'] == mappings

    empty = client.post('/api/process/financials/jubilee-hills', files=files)
    assert empty.status_code == 200
    assert seen['receipt_rate_mappings'] == []


def test_closing_stock_export_forwards_destination_rates_and_mappings(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_prepare(**kwargs):
        captured.update(kwargs)
        return {
            'productsByCategory': {},
            'layoutByCategory': {},
            'destinationBranch': kwargs.get('destination'),
        }

    monkeypatch.setattr(financials_router, 'prepare_branch_export_layout', fake_prepare)
    monkeypatch.setattr(financials_router, 'build_closing_stock_template_bytes', lambda **_k: b'xlsx')

    response = client.post(
        '/api/process/financials/export-closing-stock/kokapet',
        json={
            'salesPivot': [{'product': 'A'}],
            'destinationBranch': 'kokapet',
            'sourceAverageRates': {'jubileeHills': [{'product': 'A', 'averageRateAmt': 3}]},
            'receiptRateMappings': [{'product': 'A', 'sourceProduct': 'A1'}],
        },
    )
    assert response.status_code == 200
    assert captured['destination'] == 'kokapet'
    assert captured['source_average_rates']['jubileeHills'][0]['averageRateAmt'] == 3
    assert captured['receipt_rate_mappings'][0]['sourceProduct'] == 'A1'


def test_closing_stock_export_infers_destination_from_path_when_omitted(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_prepare(**kwargs):
        captured['destination'] = kwargs.get('destination')
        return {
            'productsByCategory': {},
            'layoutByCategory': {},
            'destinationBranch': kwargs.get('destination'),
        }

    monkeypatch.setattr(financials_router, 'prepare_branch_export_layout', fake_prepare)
    monkeypatch.setattr(financials_router, 'build_closing_stock_template_bytes', lambda **_k: b'xlsx')

    response = client.post(
        '/api/process/financials/export-closing-stock/basheerbagh',
        json={'salesPivot': [{'product': 'A'}]},
    )
    assert response.status_code == 200
    assert captured['destination'] == 'basheerbagh'

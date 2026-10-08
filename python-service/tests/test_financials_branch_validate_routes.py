"""Branch validate routes keep the existing processors and pin the branch."""

from fastapi.testclient import TestClient

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

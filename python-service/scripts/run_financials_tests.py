#!/usr/bin/env python3
"""Run the full HASS Financials test suite (Stock Reconciliation + Trading).

Usage (from repo root or python-service):
  python python-service/scripts/run_financials_tests.py
  python scripts/run_financials_tests.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

PYTHON_SERVICE = Path(__file__).resolve().parents[1]
REPO_ROOT = PYTHON_SERVICE.parent

FINANCIALS_TESTS = [
    'tests/test_financials_pivot.py',
    'tests/test_financials_router_contracts.py',
    'tests/test_closing_stock_template.py',
    'tests/test_closing_stock_product_rule_book.py',
    'tests/test_mr_dc_pivots.py',
    'tests/test_opening_stock_validation.py',
    'tests/test_trading_sheet.py',
]

BACKEND_UPLOAD_TEST = REPO_ROOT / 'backend' / 'src' / 'middleware' / 'financials.upload.test.js'


def _run(cmd: list[str], *, cwd: Path) -> int:
    print('\n>>>', ' '.join(cmd))
    print(f'    cwd={cwd}')
    completed = subprocess.run(cmd, cwd=str(cwd), check=False)
    return int(completed.returncode)


def main() -> int:
    print('HASS Financials — running test suites')
    print('=' * 60)

    pytest_cmd = [sys.executable, '-m', 'pytest', *FINANCIALS_TESTS, '-v', '--tb=short']
    py_code = _run(pytest_cmd, cwd=PYTHON_SERVICE)

    backend_code = 0
    if BACKEND_UPLOAD_TEST.is_file():
        backend_code = _run(
            ['node', '--test', str(BACKEND_UPLOAD_TEST.name)],
            cwd=BACKEND_UPLOAD_TEST.parent,
        )
    else:
        print(f'\n[skip] backend upload test not found: {BACKEND_UPLOAD_TEST}')

    print('\n' + '=' * 60)
    if py_code == 0 and backend_code == 0:
        print('RESULT: ALL FINANCIALS TESTS PASSED')
        return 0

    print('RESULT: FAILURES DETECTED')
    print(f'  python pytest exit={py_code}')
    print(f'  backend node:test exit={backend_code}')
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

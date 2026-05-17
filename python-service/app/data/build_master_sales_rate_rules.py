"""Build master_sales_rate_rules.xlsx from master_sales_rules (product-wise standard = last integer in product).

Run: python -m app.data.build_master_sales_rate_rules
"""

from __future__ import annotations

import re
from pathlib import Path

from openpyxl import Workbook

from app.services.master_rule_service import MasterRuleService

_WORKBOOK_OUT = Path(__file__).resolve().parent / 'master_sales_rate_rules.xlsx'

_RULE_ACCOUNTS = frozenset(
    {
        'JEWELS SALES ACCOUNT - COLOR STONES',
        'JEWELS SALES ACCOUNT - PEARLS',
        'JEWELS SALES ACCOUNT - EMERALDS',
        'JEWELS SALES ACCOUNT - RUBIES',
    }
)
_SKIP_PRODUCTS = frozenset(
    {
        'CUSTOMER RUBIES',
        'CUSTOMER PEARLS',
        'CUSTOMER EMERALDS',
        'CUSTOMER STONES',
        'RUBIES JRU MIX',
        'EMERALDS JEM MIX',
    }
)


def _last_integer(product: str) -> float | None:
    found = re.findall(r'\d+', product)
    if not found:
        return None
    return float(found[-1])


def main() -> None:
    rules = MasterRuleService().load_master_rules()
    body: list[tuple] = []
    for row in rules.to_dicts():
        acc = row['sales_account']
        prod = row['product']
        if acc not in _RULE_ACCOUNTS or prod in _SKIP_PRODUCTS:
            continue
        std = _last_integer(prod)
        if std is None:
            continue
        dev = 30.0
        mn = std - std * (dev / 100.0)
        mx = std + std * (dev / 100.0)
        body.append((acc, prod, std, dev, mn, mx, 'Active'))

    wb = Workbook()
    ws = wb.active
    ws.append(['Enterprise Master Sales Rate Verification'])
    ws.append([])
    ws.append(
        [
            'Sales Account Type',
            'Product',
            'Standard Rate',
            'Allowed Deviation Percent',
            'Minimum Allowed Rate',
            'Maximum Allowed Rate',
            'Status',
        ]
    )
    for tup in body:
        ws.append(list(tup))
    wb.save(_WORKBOOK_OUT)


if __name__ == '__main__':
    main()

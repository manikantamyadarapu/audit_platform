#!/usr/bin/env python3
"""Generate Sales Return Audit product coverage report from two Excel files.

Usage:
  python scripts/sales_return_product_summary.py --sales path/to/sales.xlsx --return-file path/to/return.xlsx
  python scripts/sales_return_product_summary.py --demo   # catalog-based demo workbooks
"""

from __future__ import annotations

import argparse
import json
import sys
from io import BytesIO
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.engines.sales_return_engine.engine.product_summary_report import generate_product_summary_from_files


def _build_demo_workbooks() -> tuple[bytes, bytes]:
    """Realistic catalog-style demo (business product names, partial return coverage)."""
    sales_rows = [
        {'Voucher No': 'S1', 'Sales Account': 'GOLD SALES ACCOUNT - 22K', 'Product': 'Gold Ornaments 22K', 'Unit Rate': 9000, 'Quantity': 100, 'Gross Amount': 900000, 'UOM': 'Grams'},
        {'Voucher No': 'S2', 'Sales Account': 'GOLD SALES ACCOUNT - 22K', 'Product': 'Gold Ornaments 22K', 'Unit Rate': 9200, 'Quantity': 50, 'Gross Amount': 460000, 'UOM': 'Grams'},
        {'Voucher No': 'S3', 'Sales Account': 'JEWEL SALES ACCOUNT - DIAMONDS', 'Product': 'Di. RA 15', 'Unit Rate': 15000, 'Quantity': 10, 'Gross Amount': 150000, 'UOM': 'Carats'},
        {'Voucher No': 'S4', 'Sales Account': 'JEWEL SALES ACCOUNT - DIAMONDS', 'Product': 'Di. RA 100', 'Unit Rate': 100000, 'Quantity': 2, 'Gross Amount': 200000, 'UOM': 'Carats'},
        {'Voucher No': 'S5', 'Sales Account': 'GOLD SALES ACCOUNT - 22K', 'Product': 'Flat Polki FP 1', 'Unit Rate': 5000, 'Quantity': 3, 'Gross Amount': 15000, 'UOM': 'Grams'},
        {'Voucher No': 'S6', 'Sales Account': 'Jewels sales account - Emeralds', 'Product': 'Emeralds JEM 4400', 'Unit Rate': 4400, 'Quantity': 8, 'Gross Amount': 35200, 'UOM': 'Carats'},
        {'Voucher No': 'S7', 'Sales Account': 'Jewels sales account - Pearls', 'Product': 'Pearls JPS 2000', 'Unit Rate': 2000, 'Quantity': 12, 'Gross Amount': 24000, 'UOM': 'Grams'},
        {'Voucher No': 'S8', 'Sales Account': 'GOLD SALES ACCOUNT - 22K', 'Product': 'Lac', 'Unit Rate': 0.5, 'Quantity': 20, 'Gross Amount': 10, 'UOM': 'Grams'},
        {'Voucher No': 'S9', 'Sales Account': 'GOLD SALES ACCOUNT - 22K', 'Product': 'Silver Articles', 'Unit Rate': 800, 'Quantity': 15, 'Gross Amount': 12000, 'UOM': 'Grams'},
        {'Voucher No': 'S10', 'Sales Account': 'Jewels sales account - Rubies', 'Product': 'Rubies JRU 5000', 'Unit Rate': 5000, 'Quantity': 5, 'Gross Amount': 25000, 'UOM': 'Carats'},
    ]
    return_rows = [
        {'Voucher No': 'R1', 'Sales Return Account': 'GOLD SALES RETURN ACCOUNT - 22K', 'Product': 'Gold Ornaments 22K', 'Unit Rate': 9500, 'Quantity': 10, 'Gross Amount': 95000, 'UOM': 'Grams'},
        {'Voucher No': 'R2', 'Sales Return Account': 'GOLD SALES RETURN ACCOUNT - 22K', 'Product': 'Gold Ornaments 22K', 'Unit Rate': 9600, 'Quantity': 5, 'Gross Amount': 48000, 'UOM': 'Grams'},
        {'Voucher No': 'R3', 'Sales Return Account': 'JEWEL SALES RETURN ACCOUNT - DIAMONDS', 'Product': 'Di. RA 150', 'Unit Rate': 17000, 'Quantity': 10, 'Gross Amount': 170000, 'UOM': 'Carats'},
        {'Voucher No': 'R4', 'Sales Return Account': 'GOLD SALES RETURN ACCOUNT - 22K', 'Product': 'Flat Polki FP 10', 'Unit Rate': 10000, 'Quantity': 5, 'Gross Amount': 50000, 'UOM': 'Grams'},
        {'Voucher No': 'R5', 'Sales Return Account': 'GOLD SALES RETURN ACCOUNT - 22K', 'Product': 'Chakri', 'Unit Rate': 1000, 'Quantity': 2, 'Gross Amount': 2000, 'UOM': 'Grams'},
        {'Voucher No': 'R6', 'Sales Return Account': 'Jewels sales account - Emeralds', 'Product': 'Emeralds JEM 4400', 'Unit Rate': 4500, 'Quantity': 4, 'Gross Amount': 18000, 'UOM': 'Carats'},
    ]

    def to_bytes(rows: list[dict]) -> bytes:
        buf = BytesIO()
        pd.DataFrame(rows).to_excel(buf, index=False)
        return buf.getvalue()

    return to_bytes(sales_rows), to_bytes(return_rows)


def _print_report(report: dict) -> None:
    print('=' * 72)
    print('SALES RETURN AUDIT — PRODUCT COVERAGE REPORT')
    print('=' * 72)
    print(f"Sales enriched rows:              {report['salesEnrichedRows']}")
    print(f"Return enriched rows:             {report['returnEnrichedRows']}")
    print(f"1. Total distinct products (Sales avg):     {report['totalDistinctProductsInSales']}")
    print(f"2. Total distinct products (Return avg):    {report['totalDistinctProductsInSalesReturn']}")
    print(f"3. Matched products:                        {report['matchedProducts']}")
    print(f"4. Missing in Sales (return only):          {report['missingInSales']}")
    print(f"5. Missing in Return (sales only):          {report['missingInReturn']}")

    print('\n--- Missing in Sales (would flag PRODUCT_NOT_FOUND_IN_SALES) ---')
    for item in report['missingInSalesProducts']:
        print(f"  {item['product']:<30} rows={item['returnRowCount']} avg={item['returnAverageRate']}")

    print('\n--- Missing in Return (currently NOT flagged — sales-only) ---')
    for item in report['missingInReturnProducts']:
        print(f"  {item['product']:<30} rows={item['salesRowCount']} avg={item['salesAverageRate']}")

    print('\n--- Top 20 products by row count ---')
    print(f"{'Product':<32} {'Sales':>6} {'Return':>7} {'Status':<18}")
    print('-' * 72)
    for item in report['top20ProductsByRowCount']:
        print(
            f"{item['product'][:32]:<32} {item['salesRowCount']:>6} {item['returnRowCount']:>7} {item['matchStatus']:<18}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description='Sales Return product coverage report')
    parser.add_argument('--sales', type=Path, help='Sales Audit Excel path')
    parser.add_argument('--return-file', type=Path, dest='return_path', help='Sales Return Excel path')
    parser.add_argument('--demo', action='store_true', help='Run on built-in catalog-style demo files')
    parser.add_argument('--output', type=Path, help='Write JSON report to path')
    args = parser.parse_args()

    if args.demo:
        sales_bytes, return_bytes = _build_demo_workbooks()
        out_dir = ROOT / 'debug'
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / 'demo_sales_audit.xlsx').write_bytes(sales_bytes)
        (out_dir / 'demo_sales_return_audit.xlsx').write_bytes(return_bytes)
        print(f'Demo workbooks written to {out_dir}/')
    elif args.sales and args.return_path:
        sales_bytes = args.sales.read_bytes()
        return_bytes = args.return_path.read_bytes()
    else:
        parser.error('Provide --sales and --return-file paths, or use --demo')

    report = generate_product_summary_from_files(sales_bytes, return_bytes)
    _print_report(report)

    if args.output:
        args.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f'\nJSON report written to {args.output}')
    elif args.demo:
        json_path = ROOT / 'debug' / 'sales_return_product_summary.json'
        json_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
        print(f'JSON report written to {json_path}')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())

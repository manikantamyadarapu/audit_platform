"""Product coverage summary report for Sales Return Audit."""

from io import BytesIO

import pandas as pd

from app.sales_return_engine.product_summary_report import generate_product_summary_from_files


def _build(rows: list[dict]) -> bytes:
    buf = BytesIO()
    pd.DataFrame(rows).to_excel(buf, index=False)
    return buf.getvalue()


def test_product_summary_report_counts() -> None:
    sales = _build(
        [
            {
                'Voucher No': 'S1',
                'Sales Account': 'GOLD SALES ACCOUNT - 22K',
                'Product': 'Gold Ornaments 22K',
                'Unit Rate': 9000,
                'Quantity': 100,
                'Gross Amount': 900000,
                'UOM': 'Grams',
            },
            {
                'Voucher No': 'S2',
                'Sales Account': 'JEWEL SALES ACCOUNT - DIAMONDS',
                'Product': 'Di. RA 15',
                'Unit Rate': 15000,
                'Quantity': 10,
                'Gross Amount': 150000,
                'UOM': 'Carats',
            },
        ]
    )
    returns = _build(
        [
            {
                'Voucher No': 'R1',
                'Sales Return Account': 'GOLD SALES RETURN ACCOUNT - 22K',
                'Product': 'Gold Ornaments 22K',
                'Unit Rate': 9500,
                'Quantity': 10,
                'Gross Amount': 95000,
                'UOM': 'Grams',
            },
            {
                'Voucher No': 'R2',
                'Sales Return Account': 'GOLD SALES RETURN ACCOUNT - 22K',
                'Product': 'Chakri',
                'Unit Rate': 1000,
                'Quantity': 2,
                'Gross Amount': 2000,
                'UOM': 'Grams',
            },
        ]
    )

    report = generate_product_summary_from_files(sales, returns)

    assert report['totalDistinctProductsInSales'] == 2
    assert report['totalDistinctProductsInSalesReturn'] == 2
    assert report['matchedProducts'] == 1
    assert report['missingInSales'] == 1
    assert report['missingInReturn'] == 1
    assert report['missingInReturnProducts'][0]['product'] == 'Di. RA 15'
    assert report['missingInReturnProducts'][0]['currentAuditIssue'] is None

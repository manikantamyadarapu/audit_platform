from io import BytesIO

import pandas as pd

from app.sales_return_engine.engine.sales_return_audit_engine import (
    HIGHER_SALES_RETURN_RATE,
    SalesReturnAuditEngine,
)


def _build_excel_bytes(rows: list[dict]) -> bytes:
    dataframe = pd.DataFrame(rows)
    output = BytesIO()
    dataframe.to_excel(output, index=False)
    return output.getvalue()


def _sales_rows(product: str, gross: float, qty: float, rate: float, account: str = 'GOLD SALES ACCOUNT - 22K') -> dict:
    return {
        'Voucher No': 'V1',
        'Sales Account': account,
        'Product': product,
        'Unit Rate': rate,
        'Quantity': qty,
        'Gross Amount': gross,
        'UOM': 'Grams',
    }


def test_higher_return_rate_detected() -> None:
    engine = SalesReturnAuditEngine()
    sales_bytes = _build_excel_bytes(
        [_sales_rows('Di. RA 15', 150000, 10, 15000, 'JEWEL SALES ACCOUNT - DIAMONDS')]
    )
    return_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V2',
                'Sales Return Account': 'JEWEL SALES RETURN ACCOUNT - DIAMONDS',
                'Product': 'Di. RA 15',
                'Unit Rate': 17000,
                'Quantity': 10,
                'Gross Amount': 170000,
                'UOM': 'Carats',
            }
        ]
    )
    result = engine.process(sales_bytes, return_bytes)
    comparison = result['rateComparisonRecords']
    assert len(comparison) == 1
    assert comparison[0]['issues'] == [HIGHER_SALES_RETURN_RATE]
    assert comparison[0]['salesAverageRate'] == 15000
    assert comparison[0]['returnAverageRate'] == 17000


def test_equal_return_rate_not_flagged() -> None:
    engine = SalesReturnAuditEngine()
    sales_bytes = _build_excel_bytes([_sales_rows('Di. RA 15', 150000, 10, 15000, 'JEWEL SALES ACCOUNT - DIAMONDS')])
    return_bytes = _build_excel_bytes(
        [
            {
                'Voucher No': 'V2',
                'Sales Return Account': 'JEWEL SALES RETURN ACCOUNT - DIAMONDS',
                'Product': 'Di. RA 15',
                'Unit Rate': 15000,
                'Quantity': 10,
                'Gross Amount': 150000,
                'UOM': 'Carats',
            }
        ]
    )
    result = engine.process(sales_bytes, return_bytes)
    assert result['rateComparisonRecords'] == []

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


def _stored_avg(product: str, gross: float, qty: float, account: str = '') -> list[dict]:
    return [
        {
            'product': product,
            'salesAccount': account,
            'totalGrossAmount': gross,
            'totalQuantity': qty,
            'averageRate': round(gross / qty, 4) if qty else 0,
        }
    ]


def _return_row(
    product: str,
    gross: float,
    qty: float,
    rate: float,
    account: str = 'JEWEL SALES RETURN ACCOUNT - DIAMONDS',
) -> dict:
    return {
        'Voucher No': 'V2',
        'Sales Return Account': account,
        'Product': product,
        'Unit Rate': rate,
        'Quantity': qty,
        'Gross Amount': gross,
        'UOM': 'Carats',
    }


def test_higher_return_rate_detected() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes([_return_row('Di. RA 15', 170000, 10, 17000)])
    stored = _stored_avg('Di. RA 15', 150000, 10, 'JEWEL SALES ACCOUNT - DIAMONDS')
    result = engine.process(return_bytes, stored)
    comparison = result['rateComparisonRecords']
    assert len(comparison) == 1
    assert comparison[0]['issues'] == [HIGHER_SALES_RETURN_RATE]
    assert comparison[0]['salesAverageRate'] == 15000
    assert comparison[0]['returnAverageRate'] == 17000


def test_equal_return_rate_not_flagged() -> None:
    engine = SalesReturnAuditEngine()
    return_bytes = _build_excel_bytes([_return_row('Di. RA 15', 150000, 10, 15000)])
    stored = _stored_avg('Di. RA 15', 150000, 10, 'JEWEL SALES ACCOUNT - DIAMONDS')
    result = engine.process(return_bytes, stored)
    assert result['rateComparisonRecords'] == []

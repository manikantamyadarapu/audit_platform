from io import BytesIO

import pandas as pd

from app.engines.sales_return_engine.engine.sales_return_audit_engine import (
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


def test_equal_display_rates_not_flagged_despite_float_noise() -> None:
    from app.engines.sales_return_engine.engine.sales_return_average_engine import (
        ProductAverage,
        return_average_exceeds_sales,
        _comparison_record_from_averages,
    )

    assert not return_average_exceeds_sales(2000.0001, 2000.0)
    assert not return_average_exceeds_sales(50.0004, 50.0)
    assert return_average_exceeds_sales(9500.0, 9000.0)

    sales = ProductAverage(
        product_key='RUBIES JRU 2000',
        product='Rubies JRU 2000',
        total_gross_amount=20000,
        total_quantity=10,
        average_rate=2000.0,
    )
    ret = ProductAverage(
        product_key='RUBIES JRU 2000',
        product='Rubies JRU 2000',
        total_gross_amount=20000.001,
        total_quantity=10,
        average_rate=2000.0001,
    )
    record = _comparison_record_from_averages(return_avg=ret, sales_avg=sales)
    assert record['issues'] == []
    assert record['status'] == 'OK'

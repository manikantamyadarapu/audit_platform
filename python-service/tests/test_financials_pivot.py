"""Financials Sales & Purchases product-wise pivot tests."""

from io import BytesIO

import pandas as pd
import pytest

from app.engines.financials_engine.engine.audit import FinancialsPivotAudit
from app.engines.financials_engine.engine.calculator import build_product_pivot
from app.engines.financials_engine.parsers.workbook_loader import (
    load_financials_workbook,
    parse_numeric_value,
)
from app.utils.sheet_validation_error import SheetValidationError


def _excel_bytes(
    rows: list[dict],
    *,
    title_rows: int = 0,
    columns: list[str] | None = None,
) -> bytes:
    """Build a workbook. Optional ``columns`` controls header order."""
    buffer = BytesIO()
    frame = pd.DataFrame(rows)
    if columns is not None:
        frame = frame[columns]
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        if title_rows:
            header = list(frame.columns)
            body: list[list] = []
            for i in range(title_rows):
                if i == 0:
                    body.append([f'Report Title {i}'] + [''] * (len(header) - 1))
                else:
                    body.append([''] * len(header))
            body.append(header)
            body.extend(frame.values.tolist())
            pd.DataFrame(body).to_excel(writer, index=False, header=False)
        else:
            frame.to_excel(writer, index=False)
    buffer.seek(0)
    return buffer.getvalue()


class TestParseNumeric:
    def test_commas_and_blanks(self):
        assert parse_numeric_value('20,000') == 20000.0
        assert parse_numeric_value('30,000') == 30000.0
        assert parse_numeric_value(None) == 0.0
        assert parse_numeric_value('') == 0.0
        assert parse_numeric_value(5) == 5.0

    def test_indian_grouping(self):
        assert parse_numeric_value('14,30,000.39') == 1430000.39

    def test_blank_and_dash(self):
        assert parse_numeric_value('-') == 0.0
        assert parse_numeric_value('  ') == 0.0


class TestProductPivot:
    def test_example_sales_aggregation(self):
        rows = [
            {'product': 'Gold Ring', 'quantity': 2, 'grossAmount': 20000},
            {'product': 'Gold Chain', 'quantity': 1, 'grossAmount': 30000},
            {'product': 'Gold Ring', 'quantity': 3, 'grossAmount': 30000},
        ]
        pivot = build_product_pivot(rows)
        assert pivot == [
            {'product': 'Gold Ring', 'sumOfQuantity': 5.0, 'sumOfGross': 50000.0},
            {'product': 'Gold Chain', 'sumOfQuantity': 1.0, 'sumOfGross': 30000.0},
        ]

    def test_blank_product_skipped_and_names_preserved(self):
        rows = [
            {'product': '  Gold Ring  ', 'quantity': 1, 'grossAmount': 10},
            {'product': '', 'quantity': 9, 'grossAmount': 999},
            {'product': 'Gold Ring', 'quantity': 1, 'grossAmount': 15},
        ]
        pivot = build_product_pivot(rows)
        assert len(pivot) == 1
        assert pivot[0]['product'] == 'Gold Ring'
        assert pivot[0]['sumOfQuantity'] == 2.0
        assert pivot[0]['sumOfGross'] == 25.0

    def test_sales_and_purchases_are_independent(self):
        sales = build_product_pivot(
            [{'product': 'Gold Ring', 'quantity': 2, 'grossAmount': 20000}]
        )
        purchases = build_product_pivot(
            [{'product': 'Gold Ring', 'quantity': 8, 'grossAmount': 70000}]
        )
        assert sales[0]['sumOfQuantity'] == 2.0
        assert purchases[0]['sumOfQuantity'] == 8.0
        assert sales[0]['sumOfGross'] == 20000.0
        assert purchases[0]['sumOfGross'] == 70000.0


class TestWorkbookLoader:
    def test_loads_required_columns_with_title_rows(self):
        file_bytes = _excel_bytes(
            [
                {'Product': 'Gold Ring', 'Quantity': 2, 'Gross Amount': 20000},
                {'Product': 'Gold Ring', 'Quantity': 3, 'Gross Amount': 30000},
            ],
            title_rows=3,
        )
        rows, header_index = load_financials_workbook(
            file_bytes, 'sales.xlsx', source_label='Sales'
        )
        assert header_index == 3
        assert len(rows) == 2
        assert rows[0]['product'] == 'Gold Ring'

    def test_case_insensitive_headers(self):
        file_bytes = _excel_bytes(
            [{'PRODUCT': 'Chain', 'QUANTITY': '1,000', 'GROSS AMOUNT': '12,500.50'}]
        )
        rows, _ = load_financials_workbook(
            file_bytes, 'purchases.xlsx', source_label='Purchases'
        )
        assert rows[0]['product'] == 'Chain'
        assert rows[0]['quantity'] == 1000.0
        assert rows[0]['grossAmount'] == 12500.50

    def test_column_order_does_not_matter(self):
        for order in (
            ['Product', 'Quantity', 'Gross Amount'],
            ['Quantity', 'Gross Amount', 'Product'],
            ['Gross Amount', 'Product', 'Quantity'],
        ):
            file_bytes = _excel_bytes(
                [
                    {
                        'Product': 'Gold Ring',
                        'Quantity': 2,
                        'Gross Amount': 20000,
                    }
                ],
                columns=order,
            )
            rows, _ = load_financials_workbook(
                file_bytes, 'sales.xlsx', source_label='Sales'
            )
            assert rows[0]['product'] == 'Gold Ring'
            assert rows[0]['quantity'] == 2.0
            assert rows[0]['grossAmount'] == 20000.0

    def test_skips_blank_product_round_off_rows(self):
        file_bytes = _excel_bytes(
            [
                {'Product': 'Gold Ring', 'Quantity': 1, 'Gross Amount': 100},
                {'Product': '', 'Quantity': '', 'Gross Amount': 5},
                {'Product': None, 'Quantity': 0, 'Gross Amount': 0},
                {'Product': 'Gold Chain', 'Quantity': 2, 'Gross Amount': 200},
            ]
        )
        rows, _ = load_financials_workbook(
            file_bytes, 'sales.xlsx', source_label='Sales'
        )
        assert [r['product'] for r in rows] == ['Gold Ring', 'Gold Chain']

    def test_indian_comma_gross_amount(self):
        file_bytes = _excel_bytes(
            [{'Product': 'Coin', 'Quantity': 1, 'Gross Amount': '14,30,000.39'}]
        )
        rows, _ = load_financials_workbook(
            file_bytes, 'sales.xlsx', source_label='Sales'
        )
        assert rows[0]['grossAmount'] == 1430000.39

    def test_missing_gross_amount_clear_error(self):
        file_bytes = _excel_bytes([{'Product': 'X', 'Quantity': 1}])
        with pytest.raises(SheetValidationError) as caught:
            load_financials_workbook(file_bytes, 'sales.xlsx', source_label='Sales')
        assert caught.value.code == 'MISSING_COLUMNS'
        assert 'Unable to process Sales file.' in caught.value.message
        assert 'Missing required column: Gross Amount' in caught.value.message
        assert caught.value.context['missingColumns'] == ['Gross Amount']

    def test_missing_all_required_columns(self):
        file_bytes = _excel_bytes([{'Account': 'Cash', 'Debit': 1}])
        with pytest.raises(SheetValidationError) as caught:
            load_financials_workbook(file_bytes, 'bad.xlsx', source_label='Purchases')
        assert 'Unable to process Purchases file.' in caught.value.message
        assert 'Product' in caught.value.context['missingColumns']
        assert 'Quantity' in caught.value.context['missingColumns']
        assert 'Gross Amount' in caught.value.context['missingColumns']


class TestFinancialsPivotAudit:
    def test_two_independent_pivots_from_workbooks(self):
        sales_bytes = _excel_bytes(
            [
                {'Product': 'Gold Ring', 'Quantity': 2, 'Gross Amount': 20000},
                {'Product': 'Gold Chain', 'Quantity': 1, 'Gross Amount': 30000},
                {'Product': 'Gold Ring', 'Quantity': 3, 'Gross Amount': 30000},
            ],
            title_rows=2,
            columns=['Gross Amount', 'Product', 'Quantity'],
        )
        purchases_bytes = _excel_bytes(
            [
                {'PRODUCT': 'Gold Ring', 'QUANTITY': 4, 'GROSS AMOUNT': 35000},
                {'PRODUCT': 'Silver Coin', 'QUANTITY': 10, 'GROSS AMOUNT': 8000},
            ]
        )
        result = FinancialsPivotAudit().process(
            'sales.xlsx',
            sales_bytes,
            'purchases.xlsx',
            purchases_bytes,
        )
        assert result['success'] is True
        assert result['salesPivot'] == [
            {'product': 'Gold Ring', 'sumOfQuantity': 5.0, 'sumOfGross': 50000.0},
            {'product': 'Gold Chain', 'sumOfQuantity': 1.0, 'sumOfGross': 30000.0},
        ]
        assert result['purchasesPivot'] == [
            {'product': 'Gold Ring', 'sumOfQuantity': 4.0, 'sumOfGross': 35000.0},
            {'product': 'Silver Coin', 'sumOfQuantity': 10.0, 'sumOfGross': 8000.0},
        ]
        assert result['summary']['salesProductCount'] == 2
        assert result['summary']['purchasesProductCount'] == 2
        assert result['summary']['salesTotalQuantity'] == 6.0
        assert result['summary']['salesTotalGross'] == 80000.0
        assert 'Silver Coin' not in {row['product'] for row in result['salesPivot']}

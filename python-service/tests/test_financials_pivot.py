"""Financials Sales & Purchases product-wise pivot tests."""

from io import BytesIO

import pandas as pd
import pytest

from app.engines.financials_engine.engine.audit import FinancialsPivotAudit
from app.engines.financials_engine.engine.calculator import build_product_pivot
from app.engines.financials_engine.parsers.workbook_loader import (
    load_financials_workbook,
    load_return_workbook,
    load_supplier_note_workbook,
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

    def test_standalone_loose_is_the_same_product(self):
        pivot = build_product_pivot(
            [
                {'product': 'DI RA 10', 'quantity': 2, 'grossAmount': 20},
                {'product': 'DI RA LOOSE 10', 'quantity': 3, 'grossAmount': 30},
                {'product': 'DI RA 100', 'quantity': 1, 'grossAmount': 5},
                {'product': 'DI RB 10', 'quantity': 4, 'grossAmount': 8},
                {'product': 'DI RA LOOSELY 10', 'quantity': 7, 'grossAmount': 9},
            ]
        )
        by_name = {row['product']: row for row in pivot}
        assert by_name['DI RA 10']['sumOfQuantity'] == 5.0
        assert by_name['DI RA 10']['sumOfGross'] == 50.0
        assert 'DI RA LOOSE 10' not in by_name
        assert by_name['DI RA 100']['sumOfQuantity'] == 1.0
        assert by_name['DI RB 10']['sumOfQuantity'] == 4.0
        assert by_name['DI RA LOOSELY 10']['sumOfQuantity'] == 7.0

    def test_diamond_category_words_do_not_split_the_same_code(self):
        pivot = build_product_pivot(
            [
                {'product': 'SD DI. 200', 'quantity': 2, 'grossAmount': 20},
                {'product': 'Diamonds loose DI. SD 200', 'quantity': 3, 'grossAmount': 30},
                {'product': 'SD DI. 225', 'quantity': 1, 'grossAmount': 4},
                {'product': 'Diamonds loose SD Dk Mix', 'quantity': 8, 'grossAmount': 9},
                {'product': 'SD DI. Mix', 'quantity': 6, 'grossAmount': 7},
            ]
        )
        by_name = {row['product']: row for row in pivot}
        assert by_name['SD DI. 200']['sumOfQuantity'] == 5.0
        assert by_name['SD DI. 200']['sumOfGross'] == 50.0
        assert 'Diamonds loose DI. SD 200' not in by_name
        assert by_name['SD DI. 225']['sumOfQuantity'] == 1.0
        assert by_name['Diamonds loose SD Dk Mix']['sumOfQuantity'] == 8.0
        assert by_name['SD DI. Mix']['sumOfQuantity'] == 6.0

    def test_loose_keeps_the_first_display_name(self):
        pivot = build_product_pivot(
            [
                {'product': 'DI RA LOOSE 10', 'quantity': 1, 'grossAmount': 4},
                {'product': 'DI RA 10', 'quantity': 2, 'grossAmount': 6},
            ]
        )
        assert len(pivot) == 1
        assert pivot[0]['product'] == 'DI RA LOOSE 10'
        assert pivot[0]['sumOfQuantity'] == 3.0
        assert pivot[0]['sumOfGross'] == 10.0


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

    def test_optional_category_column_is_carried_when_present(self):
        file_bytes = _excel_bytes(
            [
                {
                    'Product': 'Gold Ring',
                    'Quantity': 1,
                    'Gross Amount': 100,
                    'Category': 'Diamond',
                    'Subcategory': 'Diamonds - Beads',
                }
            ]
        )
        rows, _ = load_financials_workbook(
            file_bytes, 'sales.xlsx', source_label='Sales'
        )
        assert rows[0]['category'] == 'Diamond'
        assert rows[0]['subcategory'] == 'Diamonds - Beads'

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

    def test_supplier_notes_use_only_product_and_amount(self):
        credit_bytes = _excel_bytes(
            [
                {
                    'Voucher': 'CN-1',
                    'Product': 'Only Purchase',
                    'Quantity': 9,
                    'Gross Amount': 999,
                    'Credit Amount': '1,250.50',
                }
            ],
            title_rows=2,
        )
        debit_bytes = _excel_bytes(
            [
                {
                    'Product': 'Di. Beads',
                    'Debit Amount': 20,
                    'Quantity': 7,
                    'Gross Amount': 999,
                }
            ]
        )
        credit_rows, credit_header = load_supplier_note_workbook(
            credit_bytes,
            'credit notes from suppliers.xlsx',
            source_label='Credit Notes from Suppliers',
            note_kind='credit',
        )
        debit_rows, _ = load_supplier_note_workbook(
            debit_bytes,
            'debit notes from suppliers.xlsx',
            source_label='Debit Notes from Suppliers',
            note_kind='debit',
        )
        assert credit_header == 2
        assert credit_rows == [
            {'product': 'Only Purchase', 'quantity': 0.0, 'grossAmount': 1250.50},
        ]
        assert debit_rows == [
            {'product': 'Di. Beads', 'quantity': 0.0, 'grossAmount': 20.0},
        ]
        with pytest.raises(SheetValidationError) as caught:
            load_supplier_note_workbook(
                _excel_bytes([{'Product': 'X', 'Quantity': 1, 'Gross Amount': 10}]),
                'credit notes from suppliers.xlsx',
                source_label='Credit Notes from Suppliers',
                note_kind='credit',
            )
        assert caught.value.context['missingColumns'] == ['Credit Amount']
        assert 'Quantity' not in caught.value.context['missingColumns']

    def test_return_workbook_uses_amount_and_ignores_other_columns(self):
        file_bytes = _excel_bytes(
            [
                {
                    'Product': 'Di. Beads',
                    'Quantity': 2,
                    'Amount': 150,
                    'Gross Amount': 999,
                    'Rate': 75,
                }
            ]
        )
        rows, _header = load_return_workbook(
            file_bytes,
            'sales return.xlsx',
            source_label='Sales Return',
        )
        assert rows == [{'product': 'Di. Beads', 'quantity': 2.0, 'grossAmount': 150.0}]

    def test_return_workbook_uses_the_sheet_that_has_the_products(self):
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            pd.DataFrame([{'Product': 'Total', 'Quantity': 9, 'Amount': 90}]).to_excel(
                writer, sheet_name='Cover', index=False
            )
            pd.DataFrame(
                [
                    {'Item Name': 'Di. Beads', 'Qty': 2, 'Amount': 150},
                    {'Item Name': 'Emeralds JEM 100', 'Qty': 1, 'Amount': 40},
                ]
            ).to_excel(writer, sheet_name='Returns', index=False)
        rows, _header = load_return_workbook(
            buffer.getvalue(),
            'sales return.xlsx',
            source_label='Sales Return',
        )
        assert [row['product'] for row in rows] == ['Di. Beads', 'Emeralds JEM 100']
        assert rows[0]['quantity'] == 2.0
        assert rows[0]['grossAmount'] == 150.0


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
        assert result['fileType'] == 'closing_stock'
        assert result['auditKey'] == 'FINANCIALS_PIVOT'
        assert result['errorRows'] == result['summary']['unmappedProductCount']

    def test_sales_purchases_only_skips_opening_and_transfers(self):
        sales_bytes = _excel_bytes(
            [{'Product': 'Gold Ring', 'Quantity': 2, 'Gross Amount': 20000}],
        )
        purchases_bytes = _excel_bytes(
            [{'Product': 'Gold Ring', 'Quantity': 1, 'Gross Amount': 9000}],
        )
        result = FinancialsPivotAudit().process(
            'sales.xlsx',
            sales_bytes,
            'purchases.xlsx',
            purchases_bytes,
        )
        assert result['salesPivot'] == [
            {'product': 'Gold Ring', 'sumOfQuantity': 2.0, 'sumOfGross': 20000.0},
        ]
        assert result['purchasesPivot'] == [
            {'product': 'Gold Ring', 'sumOfQuantity': 1.0, 'sumOfGross': 9000.0},
        ]
        assert result['openingPivot'] == []
        assert result['summary']['openingProductCount'] == 0
        assert result['summary']['mrClassifiedRows'] == 0
        assert result['summary']['dcClassifiedRows'] == 0

    def test_jubilee_hills_nets_same_products_only(self):
        sales_bytes = _excel_bytes(
            [
                {'Product': 'Di. Beads', 'Quantity': 10, 'Gross Amount': 1000},
                {'Product': 'Emeralds JEM 100', 'Quantity': 4, 'Gross Amount': 400},
            ]
        )
        purchases_bytes = _excel_bytes(
            [
                {'Product': 'Di. Beads', 'Quantity': 8, 'Gross Amount': 800},
                {'Product': 'Only Purchase', 'Quantity': 3, 'Gross Amount': 300},
            ]
        )
        sales_return_bytes = _excel_bytes(
            [
                {'Product': 'Di. Beads', 'Quantity': 2, 'Gross Amount': 150},
                {'Product': 'Return Only', 'Quantity': 9, 'Gross Amount': 90},
            ]
        )
        purchase_return_bytes = _excel_bytes(
            [{'Product': 'Di. Beads', 'Quantity': 1, 'Gross Amount': 50}]
        )
        credit_bytes = _excel_bytes(
            [
                {
                    'Product': 'Only Purchase',
                    'Credit Amount': 40,
                    'Quantity': 9,
                    'Gross Amount': 999,
                }
            ]
        )
        debit_bytes = _excel_bytes(
            [
                {
                    'Product': 'Di. Beads',
                    'Debit Amount': 20,
                    'Quantity': 7,
                    'Gross Amount': 999,
                },
                {
                    'Product': 'Debit Only',
                    'Debit Amount': 55,
                    'Quantity': 5,
                    'Gross Amount': 999,
                },
            ]
        )
        before = FinancialsPivotAudit().process(
            'sales.xlsx',
            sales_bytes,
            'purchases.xlsx',
            purchases_bytes,
        )
        result = FinancialsPivotAudit().process_jubilee_hills(
            'sales.xlsx',
            sales_bytes,
            'purchases.xlsx',
            purchases_bytes,
            sales_return_file_name='sales return.xlsx',
            sales_return_bytes=sales_return_bytes,
            purchase_return_file_name='purchase return.xlsx',
            purchase_return_bytes=purchase_return_bytes,
            credit_note_file_name='credit notes from suppliers.xlsx',
            credit_note_bytes=credit_bytes,
            debit_note_file_name='debit notes from suppliers.xlsx',
            debit_note_bytes=debit_bytes,
        )
        sales = {row['product']: row for row in result['salesPivot']}
        purchases = {row['product']: row for row in result['purchasesPivot']}
        assert sales['Di. Beads']['sumOfQuantity'] == 10.0
        assert sales['Di. Beads']['sumOfGross'] == 1000.0
        assert sales['Emeralds JEM 100']['sumOfQuantity'] == 4.0
        assert 'Return Only' not in sales
        assert purchases['Di. Beads']['sumOfQuantity'] == 8.0
        assert purchases['Di. Beads']['sumOfGross'] == 800.0
        assert purchases['Only Purchase']['sumOfQuantity'] == 3.0
        assert 'Debit Only' not in purchases
        returns = {row['product']: row for row in result['salesReturnPivot']}
        assert returns['Di. Beads']['sumOfQuantity'] == 2.0
        assert returns['Return Only']['sumOfGross'] == 90.0
        assert {row['product'] for row in result['supplierDebitNotePivot']} == {'Di. Beads', 'Debit Only'}
        nets = {row['product']: row for row in result['salesPurchaseNet']['products']}
        assert set(nets) == {
            'Di. Beads',
            'Emeralds JEM 100',
            'Only Purchase',
            'Return Only',
            'Debit Only',
        }
        assert result['salesPurchaseNet']['unaccountedProducts'] == []
        assert result['salesPurchaseNet']['inputProductCount'] == 5
        assert result['salesPurchaseNet']['accountedProductCount'] == 5
        assert nets['Di. Beads']['netSalesQty'] == 8.0
        assert nets['Di. Beads']['netSalesAmount'] == 850.0
        assert nets['Di. Beads']['netPurchaseQty'] == 7.0
        assert nets['Di. Beads']['netPurchaseAmount'] == 770.0
        assert nets['Only Purchase']['netPurchaseQty'] == 3.0
        assert nets['Only Purchase']['netPurchaseAmount'] == 260.0
        assert nets['Return Only']['netSalesQty'] == -9.0
        assert nets['Debit Only']['netPurchaseAmount'] == 55.0
        assert nets['Debit Only']['netPurchaseQty'] == 0.0
        sheet_rows = [
            row
            for row in result['layoutByCategory']['Diamond']
            if row.get('kind') == 'product' and row.get('label') == 'Di. Beads'
        ]
        assert sheet_rows[0]['salesQty'] == 8.0
        assert sheet_rows[0]['salesAmt'] == 850.0
        assert sheet_rows[0]['purchasesQty'] == 7.0
        assert sheet_rows[0]['purchasesAmt'] == 770.0
        assert 'Return Only' in result['unmappedProducts']
        assert 'Debit Only' in result['unmappedProducts']
        assert before['salesPivot'][0]['sumOfQuantity'] == 10.0
        assert result['branch'] == 'jubilee-hills'

    def test_sales_purchases_pivot_endpoint_shape_has_no_closing_stock(self):
        sales_bytes = _excel_bytes(
            [
                {'Product': 'Gold Ring', 'Quantity': 2, 'Gross Amount': 10},
                {'Product': 'Gold Ring', 'Quantity': 3, 'Gross Amount': 5.5},
            ]
        )
        purchases_bytes = _excel_bytes(
            [{'Product': 'Silver Coin', 'Quantity': 4, 'Gross Amount': 8}],
        )
        result = FinancialsPivotAudit().process_sales_purchases_pivots(
            'sales.xlsx',
            sales_bytes,
            'purchases.xlsx',
            purchases_bytes,
        )
        assert result['salesPivot'] == [
            {'product': 'Gold Ring', 'sumOfQuantity': 5.0, 'sumOfGross': 15.5},
        ]
        assert result['purchasesPivot'] == [
            {'product': 'Silver Coin', 'sumOfQuantity': 4.0, 'sumOfGross': 8.0},
        ]
        assert result['summary']['salesTotalQuantity'] == 5.0
        assert result['summary']['purchasesTotalGross'] == 8.0
        assert 'openingPivot' not in result
        assert 'layoutByCategory' not in result
        assert 'mrPivots' not in result
        assert 'dcPivots' not in result


class TestClosingStockFramework:
    def test_rules_stub_not_implemented(self):
        from app.engines.financials_engine.engine.rules import (
            ClosingStockRulesNotImplementedError,
            apply_closing_stock_measures,
            build_blank_measure_values,
        )

        blank = build_blank_measure_values()
        assert blank['openingQty'] is None
        assert blank['closingAmount'] is None

        with pytest.raises(ClosingStockRulesNotImplementedError):
            apply_closing_stock_measures()

    def test_processor_delegates_to_audit(self):
        from app.engines.financials_engine.engine.processor import FinancialsClosingStockProcessor

        sales_bytes = _excel_bytes(
            [{'Product': 'Gold Ring', 'Quantity': 1, 'Gross Amount': 1000}],
        )
        purchases_bytes = _excel_bytes(
            [{'Product': 'Gold Ring', 'Quantity': 2, 'Gross Amount': 2000}],
        )
        result = FinancialsClosingStockProcessor().process(
            'sales.xlsx',
            sales_bytes,
            'purchases.xlsx',
            purchases_bytes,
        )
        assert result['success'] is True
        assert len(result['salesPivot']) == 1

"""Section 44AB Cash & Bank Audit tests."""

import pytest
from io import BytesIO
import pandas as pd
from app.engines.section44ab_engine.engine.audit import Section44ABAudit
from app.engines.section44ab_engine.parsers.workbook_loader import (
    _is_opening_balance_row,
    _parse_numeric_value,
    load_section44ab_workbook,
    load_section44ab_files,
)


class TestOpeningBalanceExclusion:
    """TC01: Cash opening Balance b/f Debit is excluded."""

    def test_balance_bf_excluded(self):
        assert _is_opening_balance_row('Balance b/f') is True
        assert _is_opening_balance_row('Balance B/F') is True
        assert _is_opening_balance_row('Balance BF') is True

    def test_opening_balance_excluded(self):
        assert _is_opening_balance_row('Opening Balance') is True

    def test_ob_excluded(self):
        assert _is_opening_balance_row('OB') is True

    def test_case_insensitive(self):
        assert _is_opening_balance_row('balance b/f') is True
        assert _is_opening_balance_row('BALANCE B/F') is True
        assert _is_opening_balance_row('opening balance') is True

    def test_normal_transaction_not_excluded(self):
        assert _is_opening_balance_row('Contra Account ABC') is False
        assert _is_opening_balance_row('Bank Transfer') is False
        assert _is_opening_balance_row('') is False


class TestNumericParsing:
    """TC11: Blank Debit/Credit values do not crash processing.
    TC12: Comma-formatted numeric values are parsed correctly.
    """

    def test_blank_values(self):
        assert _parse_numeric_value(None) is None
        assert _parse_numeric_value('') is None
        assert _parse_numeric_value(float('nan')) is None

    def test_comma_formatted_values(self):
        assert _parse_numeric_value('11,233,145.00') == 11233145.0
        assert _parse_numeric_value('4,018,000.00') == 4018000.0
        assert _parse_numeric_value('1,234.56') == 1234.56

    def test_numeric_values(self):
        assert _parse_numeric_value(1000) == 1000.0
        assert _parse_numeric_value(1000.50) == 1000.50
        assert _parse_numeric_value('1000') == 1000.0
        assert _parse_numeric_value('1000.50') == 1000.50

    def test_invalid_strings(self):
        assert _parse_numeric_value('invalid') is None
        assert _parse_numeric_value('abc123') is None


def create_test_excel(data, header_row=0):
    """Helper to create a test Excel file.

    `header_row` pads blank rows before `data` so the first data row lands at that index.
    Do not also embed the same padding inside `data`.
    """
    rows = list(data)
    if header_row > 0:
        width = max((len(r) for r in rows), default=1)
        rows = [[''] * width for _ in range(header_row)] + rows
    df = pd.DataFrame(rows)
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, header=False, startrow=0)
    buffer.seek(0)
    return buffer.getvalue()


class TestCashCalculations:
    """TC02: Cash normal Debit transactions are summed.
    TC03: Cash Credit transactions are summed.
    """

    def test_cash_debit_summed(self):
        """TC02: Cash normal Debit transactions are summed."""
        # Create Excel with header and data
        data = [
            ['Account: Cash Account'],  # Account name in header
            [],  # Empty row
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Sales', '1000', '0', '1000'],
            ['2024-01-02', 'V002', 'Receipt', '2000', '0', '3000'],
            ['2024-01-03', 'V003', 'Balance b/f', '5000', '0', '8000'],  # Opening balance - should be excluded
            ['2024-01-04', 'V004', 'Collection', '1500', '0', '9500'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'cash_test.xlsx', is_cash=True)
        
        # Debit should exclude opening balance (5000)
        # Expected: 1000 + 2000 + 1500 = 4500
        assert result.processing_status == 'success'
        assert result.debit_total == 4500.0
        assert result.opening_balance_rows_excluded == 1

    def test_cash_credit_summed(self):
        """TC03: Cash Credit transactions are summed."""
        data = [
            ['Account: Cash Account'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Payment', '0', '1000', '-1000'],
            ['2024-01-02', 'V002', 'Expense', '0', '2000', '-3000'],
            ['2024-01-03', 'V003', 'Balance b/f', '0', '5000', '-8000'],  # Opening balance - should be excluded
            ['2024-01-04', 'V004', 'Purchase', '0', '1500', '-9500'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'cash_test.xlsx', is_cash=True)
        
        # Credit should exclude opening balance (5000)
        # Expected: 1000 + 2000 + 1500 = 4500
        assert result.processing_status == 'success'
        assert result.credit_total == 4500.0
        assert result.opening_balance_rows_excluded == 1


class TestBankCalculations:
    """TC04: Bank opening Balance b/f is excluded.
    TC05: Bank Debit transactions populate Column 3 only.
    TC06: Bank Credit transactions populate Column 5 only.
    """

    def test_bank_opening_balance_excluded(self):
        """TC04: Bank opening Balance b/f is excluded."""
        data = [
            ['Account: HDFC Bank'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Deposit', '10000', '0', '10000'],
            ['2024-01-02', 'V002', 'Balance b/f', '50000', '0', '60000'],  # Opening balance
            ['2024-01-03', 'V003', 'Transfer', '20000', '0', '80000'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'bank_test.xlsx', is_cash=False)
        
        # Debit should exclude opening balance (50000)
        # Expected: 10000 + 20000 = 30000
        assert result.processing_status == 'success'
        assert result.debit_total == 30000.0
        assert result.opening_balance_rows_excluded == 1

    def test_bank_debit_column_3_only(self):
        """TC05: Bank Debit transactions populate Column 3 only."""
        data = [
            ['Account: ICICI Bank'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Deposit', '5000', '0', '5000'],
            ['2024-01-02', 'V002', 'Transfer', '3000', '0', '8000'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'bank_test.xlsx', is_cash=False)
        
        assert result.processing_status == 'success'
        assert result.debit_total == 8000.0

    def test_bank_credit_column_5_only(self):
        """TC06: Bank Credit transactions populate Column 5 only."""
        data = [
            ['Account: Axis Bank'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Withdrawal', '0', '2000', '-2000'],
            ['2024-01-02', 'V002', 'Payment', '0', '4000', '-6000'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'bank_test.xlsx', is_cash=False)
        
        assert result.processing_status == 'success'
        assert result.credit_total == 6000.0


class TestAccountNameExtraction:
    """TC07: Full Bank Account name is extracted correctly."""

    def test_account_name_extraction(self):
        """TC07: Full Bank Account name is extracted correctly."""
        data = [
            ['Account: American Express Corp - Credit cards account'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '1000', '0', '1000'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'bank_test.xlsx', is_cash=False)
        
        assert result.processing_status == 'success'
        assert result.account_name == 'American Express Corp - Credit cards account'

    def test_default_cash_account_name(self):
        data = [
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '1000', '0', '1000'],
        ]
        file_bytes = create_test_excel(data, header_row=1)
        
        result = load_section44ab_workbook(file_bytes, 'cash_test.xlsx', is_cash=True)
        
        assert result.processing_status == 'success'
        assert result.account_name == 'Cash Account'


class TestMultipleFiles:
    """TC08: Multiple Bank files generate separate report rows.
    TC16: Large-file processing produces the correct aggregated totals.
    """

    def test_multiple_bank_files(self):
        """TC08: Multiple Bank files generate separate report rows."""
        # Bank file 1
        data1 = [
            ['Account: HDFC Bank'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Deposit', '10000', '0', '10000'],
        ]
        file1_bytes = create_test_excel(data1, header_row=2)
        
        # Bank file 2
        data2 = [
            ['Account: ICICI Bank'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Deposit', '20000', '0', '20000'],
        ]
        file2_bytes = create_test_excel(data2, header_row=2)
        
        bank_files = [('hdfc.xlsx', file1_bytes), ('icici.xlsx', file2_bytes)]
        cash_files = []
        
        loaded = load_section44ab_files(cash_files, bank_files)
        
        assert len(loaded.bank_results) == 2
        assert loaded.bank_results[0].account_name == 'HDFC Bank'
        assert loaded.bank_results[1].account_name == 'ICICI Bank'
        assert loaded.bank_results[0].debit_total == 10000.0
        assert loaded.bank_results[1].debit_total == 20000.0

    def test_large_file_aggregation(self):
        """TC16: Large-file processing produces the correct aggregated totals."""
        # Create a file with many rows
        rows = [['Account: Test Bank'], [], ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance']]
        for i in range(100):
            rows.append(['2024-01-01', f'V{i:03d}', 'Test', '100', '0', str(100 * (i + 1))])
        
        file_bytes = create_test_excel(rows, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'large_test.xlsx', is_cash=False)
        
        assert result.processing_status == 'success'
        assert result.total_data_rows == 100
        assert result.debit_total == 10000.0  # 100 * 100


class TestPercentageCalculations:
    """TC09: Cash receipt percentage is calculated as Total Col2 / Total Col3 × 100.
    TC10: Cash payment percentage is calculated as Total Col4 / Total Col5 × 100.
    TC15: Zero denominator does not crash percentage calculation.
    """

    def test_receipt_percentage_calculation(self):
        """TC09: Cash receipt percentage is calculated as Total Col2 / Total Col3 × 100."""
        audit = Section44ABAudit()
        
        # Cash file with debit = 10000
        cash_data = [
            ['Account: Cash Account'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '10000', '0', '10000'],
        ]
        cash_bytes = create_test_excel(cash_data, header_row=2)
        
        # Bank file with debit = 5000
        bank_data = [
            ['Account: HDFC Bank'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '5000', '0', '5000'],
        ]
        bank_bytes = create_test_excel(bank_data, header_row=2)
        
        cash_files = [('cash.xlsx', cash_bytes)]
        bank_files = [('bank.xlsx', bank_bytes)]
        
        result = audit.process(cash_files, bank_files)
        
        # Receipt % = Total Col2 / Total Col3 × 100
        # Col2 = Cash Debit = 10000
        # Col3 = Cash Debit + Bank Debit = 10000 + 5000 = 15000
        # Receipt % = 10000 / 15000 × 100 = 66.67%
        assert result['success'] is True
        assert abs(result['summary']['receiptPercentage'] - 66.67) < 0.1

    def test_payment_percentage_calculation(self):
        """TC10: Cash payment percentage is calculated as Total Col4 / Total Col5 × 100."""
        audit = Section44ABAudit()
        
        # Cash file with credit = 8000
        cash_data = [
            ['Account: Cash Account'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '0', '8000', '-8000'],
        ]
        cash_bytes = create_test_excel(cash_data, header_row=2)
        
        # Bank file with credit = 2000
        bank_data = [
            ['Account: HDFC Bank'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '0', '2000', '-2000'],
        ]
        bank_bytes = create_test_excel(bank_data, header_row=2)
        
        cash_files = [('cash.xlsx', cash_bytes)]
        bank_files = [('bank.xlsx', bank_bytes)]
        
        result = audit.process(cash_files, bank_files)
        
        # Payment % = Total Col4 / Total Col5 × 100
        # Col4 = Cash Credit = 8000
        # Col5 = Cash Credit + Bank Credit = 10000
        # Payment % = 8000 / 10000 × 100 = 80%
        assert result['success'] is True
        assert abs(result['summary']['paymentPercentage'] - 80.0) < 0.1

    def test_zero_denominator_handling(self):
        """TC15: Zero denominator does not crash percentage calculation."""
        audit = Section44ABAudit()
        
        # Cash file with debit = 10000
        cash_data = [
            ['Account: Cash Account'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '10000', '0', '10000'],
        ]
        cash_bytes = create_test_excel(cash_data, header_row=2)
        
        # No bank files - Col3 = Col2 = 10000
        cash_files = [('cash.xlsx', cash_bytes)]
        bank_files = []
        
        result = audit.process(cash_files, bank_files)
        
        # Receipt % = 10000 / 10000 × 100 = 100%
        assert result['success'] is True
        assert result['summary']['receiptPercentage'] == 100.0
        
        # Test with zero denominator (no transactions)
        empty_data = [
            ['Account: Cash Account'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
        ]
        empty_bytes = create_test_excel(empty_data, header_row=2)
        
        result_empty = audit.process([('empty.xlsx', empty_bytes)], [])
        
        # Should not crash, percentage should be 0
        assert result_empty['success'] is True
        assert result_empty['summary']['receiptPercentage'] == 0.0


class TestHeaderDetection:
    """TC13: Different Excel header-row positions are detected.
    TC14: Optional Remarks/Division/SNo columns can be absent.
    """

    def test_header_at_row_5(self):
        """TC13: Different Excel header-row positions are detected."""
        data = [
            ['Title Row 1'],
            ['Title Row 2'],
            ['Title Row 3'],
            ['Title Row 4'],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '1000', '0', '1000'],
        ]
        file_bytes = create_test_excel(data, header_row=0)
        
        result = load_section44ab_workbook(file_bytes, 'test.xlsx', is_cash=True)
        
        assert result.processing_status == 'success'
        assert result.header_row_index == 4

    def test_header_at_row_10(self):
        data = [
            *[['Title']] * 9,
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '1000', '0', '1000'],
        ]
        file_bytes = create_test_excel(data, header_row=0)
        
        result = load_section44ab_workbook(file_bytes, 'test.xlsx', is_cash=True)
        
        assert result.processing_status == 'success'
        assert result.header_row_index == 9

    def test_optional_columns_absent(self):
        """TC14: Optional Remarks/Division/SNo columns can be absent."""
        data = [
            ['Account: Cash Account'],
            [],
            ['Date', 'Voucher No', 'Contra Account', 'Debit', 'Credit', 'Balance'],
            ['2024-01-01', 'V001', 'Test', '1000', '0', '1000'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'test.xlsx', is_cash=True)
        
        # Should succeed without optional columns
        assert result.processing_status == 'success'
        assert result.debit_total == 1000.0

    def test_optional_columns_present(self):
        data = [
            ['Account: Cash Account'],
            [],
            ['SNo', 'Date', 'Voucher No', 'Branch', 'Contra Account', 'Debit', 'Credit', 'Balance', 'Remarks', 'Division'],
            ['1', '2024-01-01', 'V001', 'Branch1', 'Test', '1000', '0', '1000', 'Test remark', 'Div1'],
        ]
        file_bytes = create_test_excel(data, header_row=2)
        
        result = load_section44ab_workbook(file_bytes, 'test.xlsx', is_cash=True)
        
        # Should succeed with optional columns present
        assert result.processing_status == 'success'
        assert result.debit_total == 1000.0

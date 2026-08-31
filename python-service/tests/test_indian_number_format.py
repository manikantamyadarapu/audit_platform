"""Tests for Indian number formatting."""

from __future__ import annotations

from app.utils.indian_number_format import INDIAN_NUMBER_FORMAT, format_indian_number


class TestIndianNumberFormat:
    def test_format_indian_number_examples(self):
        assert format_indian_number(1000) == '1,000'
        assert format_indian_number(10000) == '10,000'
        assert format_indian_number(100000) == '1,00,000'
        assert format_indian_number(1000000) == '10,00,000'
        assert format_indian_number(10000000) == '1,00,00,000'

    def test_closing_stock_examples(self):
        assert format_indian_number(856435) == '8,56,435'
        assert format_indian_number(103616) == '1,03,616'
        assert format_indian_number(1107713) == '11,07,713'

    def test_optional_decimals_when_requested(self):
        assert format_indian_number(12345678.90, max_decimals=2) == '1,23,45,678.9'
        assert format_indian_number(1234.5, max_decimals=1) == '1,234.5'

    def test_excel_format_is_indian(self):
        assert '[>=10000000]' in INDIAN_NUMBER_FORMAT
        assert '##,##,##0' in INDIAN_NUMBER_FORMAT
        assert '#,##0.####' in INDIAN_NUMBER_FORMAT

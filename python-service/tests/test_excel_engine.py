"""Tests for Excel engine resolution."""

from app.utils.excel_engine import resolve_pandas_excel_engine


def test_resolve_engine_from_xls_extension():
    assert resolve_pandas_excel_engine(file_name='1. Smt. Arpita Agarwal.xls') == 'xlrd'


def test_resolve_engine_from_xlsx_extension():
    assert resolve_pandas_excel_engine(file_name='ledger.xlsx') == 'openpyxl'


def test_resolve_engine_from_ole_signature():
    assert resolve_pandas_excel_engine(file_bytes=b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1') == 'xlrd'


def test_resolve_engine_from_zip_signature():
    assert resolve_pandas_excel_engine(file_bytes=b'PK\x03\x04') == 'openpyxl'

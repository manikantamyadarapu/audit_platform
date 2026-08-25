"""Select the pandas Excel engine for legacy .xls vs modern .xlsx/.xlsm workbooks."""

from __future__ import annotations

from pathlib import Path

_OLE2_SIGNATURE = b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1'
_ZIP_SIGNATURE = b'PK'

_XLSX_EXTENSIONS = frozenset({'.xlsx', '.xlsm'})
_XLS_EXTENSION = '.xls'


def resolve_pandas_excel_engine(
    *,
    file_name: str | None = None,
    file_bytes: bytes | None = None,
) -> str:
    """
    Return ``openpyxl`` for OOXML workbooks or ``xlrd`` for legacy binary .xls.

    Resolution order: filename extension, then file signature, then openpyxl default.
    """
    if file_name:
        ext = Path(file_name).suffix.lower()
        if ext == _XLS_EXTENSION:
            return 'xlrd'
        if ext in _XLSX_EXTENSIONS:
            return 'openpyxl'

    if file_bytes:
        if file_bytes.startswith(_OLE2_SIGNATURE):
            return 'xlrd'
        if file_bytes.startswith(_ZIP_SIGNATURE):
            return 'openpyxl'

    return 'openpyxl'

from pathlib import Path

from fastapi import UploadFile

from app.utils.constants import ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES


def validate_upload_file(file: UploadFile) -> None:
    if not file.filename:
        raise ValueError('Filename is missing')

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError('Unsupported file extension. Use .xlsx, .xlsm, or .xls')

    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise ValueError('Unsupported file type')

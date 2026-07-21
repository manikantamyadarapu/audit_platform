from fastapi import UploadFile

from app.services.engine_factory import get_processor
from app.validators.common_validator import validate_upload_file


class ProcessingService:
    async def process(self, file_type: str, upload_file: UploadFile) -> dict:
        validate_upload_file(upload_file)
        file_bytes = await upload_file.read()
        if not file_bytes:
            raise ValueError('Uploaded file is empty')

        processor = get_processor(file_type)
        return processor.process(file_bytes)

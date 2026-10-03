from fastapi import UploadFile

from app.services.engine_factory import get_processor
from app.utils.async_work import run_sync
from app.validators.common_validator import validate_upload_file


class ProcessingService:
    async def process(self, file_type: str, upload_file: UploadFile) -> dict:
        validate_upload_file(upload_file)
        file_bytes = await upload_file.read()
        if not file_bytes:
            raise ValueError('Uploaded file is empty')

        processor = get_processor(file_type)
        # CPU-bound Excel audit work must not block the FastAPI event loop.
        return await run_sync(processor.process, file_bytes)

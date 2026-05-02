from typing import Any

from app.processors.base import BaseProcessor
from app.utils.excel_reader import ExcelReader
from app.utils.response_builder import build_processing_response


class GstProcessor(BaseProcessor):
    REQUIRED_COLUMNS = {'gst'}

    def __init__(self) -> None:
        self.reader = ExcelReader()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        df = self.reader.read_excel(file_bytes)
        missing = self.REQUIRED_COLUMNS - set(df.columns)
        if missing:
            raise KeyError(f"Missing required columns: {', '.join(sorted(missing))}")

        # Skeleton: implement missing, invalid, and duplicate GST checks.
        return build_processing_response(
            file_type='gst',
            total_rows=len(df),
            error_rows=0,
            summary={
                'missingGst': 0,
                'invalidGst': 0,
                'duplicateGst': 0,
            },
            records=[],
        )

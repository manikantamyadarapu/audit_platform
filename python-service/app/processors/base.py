from abc import ABC, abstractmethod
from typing import Any


class BaseProcessor(ABC):
    @abstractmethod
    def process(self, file_bytes: bytes, **kwargs: Any) -> dict:
        """Process workbook bytes. Optional kwargs e.g. original_filename for format sniffing."""
        raise NotImplementedError

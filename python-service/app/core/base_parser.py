"""Shared base parser for audit engines."""

from abc import ABC, abstractmethod
from typing import Any


class BaseParser(ABC):
    @abstractmethod
    def parse(self, file_bytes: bytes) -> Any:
        raise NotImplementedError

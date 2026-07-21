from abc import ABC, abstractmethod


class BaseProcessor(ABC):
    @abstractmethod
    def process(self, file_bytes: bytes) -> dict:
        raise NotImplementedError

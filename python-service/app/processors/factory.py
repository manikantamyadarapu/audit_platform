from app.processors.base import BaseProcessor
from app.processors.gross_weight_processor import GrossWeightProcessor
from app.processors.pan_processor import PanProcessor

PROCESSOR_REGISTRY = {
    'pan': PanProcessor,
    'gross_weight': GrossWeightProcessor,
}


def get_processor(file_type: str) -> BaseProcessor:
    processor_cls = PROCESSOR_REGISTRY.get(file_type)
    if not processor_cls:
        raise ValueError(f'Unsupported file type: {file_type}')
    return processor_cls()

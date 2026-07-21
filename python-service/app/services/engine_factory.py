from app.core.base_processor import BaseProcessor
from app.engines.cash_ledger_engine.engine.processor import CashLedgerProcessor
from app.engines.gross_weight_engine.engine.processor import GrossWeightProcessor
from app.engines.negative_bank_engine.engine.processor import NegativeBankProcessor
from app.engines.pan_engine.engine.processor import PanProcessor
from app.engines.sales_engine.engine.processor import SalesAuditProcessor
from app.engines.purchase_engine.engine.processor import PurchaseAuditProcessor

PROCESSOR_REGISTRY = {
    'pan': PanProcessor,
    'gross_weight': GrossWeightProcessor,
    'sales': SalesAuditProcessor,
    'purchase': PurchaseAuditProcessor,
    'cash_ledger': CashLedgerProcessor,
    'negative_bank': NegativeBankProcessor,
}


def get_processor(file_type: str) -> BaseProcessor:
    processor_cls = PROCESSOR_REGISTRY.get(file_type)
    if not processor_cls:
        raise ValueError(f'Unsupported file type: {file_type}')
    return processor_cls()

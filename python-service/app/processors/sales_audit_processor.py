"""Official jewelry sales ledger validation (account mapping + gemstone slab rates)."""

from typing import Any

from app.engines.vectorized_sales_engine import VectorizedSalesEngine
from app.processors.base import BaseProcessor
from app.utils.response_builder import build_processing_response
from app.utils.sheet_validation_error import SheetValidationError

_REQUIRED = frozenset({'voucher_no', 'sales_account', 'product', 'unit_rate'})


class SalesAuditProcessor(BaseProcessor):
    """Validate sales account ↔ product mapping and gemstone slab unit rates."""

    def __init__(self) -> None:
        self.engine = VectorizedSalesEngine()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        loaded = self.engine.load_sales_sheet(file_bytes)
        data_columns = self.engine.loader.user_columns(loaded.dataframe)
        missing = _REQUIRED - set(data_columns)
        if missing:
            found = sorted(c for c in data_columns if str(c).strip())
            header_excel = int(loaded.header_row_index) + 1
            raise SheetValidationError(
                f"Missing required columns after header detection: {', '.join(sorted(missing))}",
                code='MISSING_REQUIRED_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=found,
                headerRowExcel=header_excel,
                expectedColumns=sorted(_REQUIRED),
                hints=[
                    'Sales audit uses official account ↔ product families and gemstone slab rates '
                    'embedded in product names (Rubies, Emeralds, Pearls, Color stones).',
                    'The uploaded sheet must provide voucher_no, sales_account, product, and '
                    'unit_rate after header normalization. Example: "Voucher No" → voucher_no, '
                    '"Unit Rate" → unit_rate.',
                    'Preamble/title rows above the real header are supported, but the actual header '
                    'row must contain all four required fields.',
                ],
            )

        result = self.engine.validate_loaded_sheet(loaded)
        distinct_invalid = int(
            result.summary.get('distinctInvalidRows')
            or result.summary.get('errorRowsCount')
            or len(result.records)
        )
        return build_processing_response(
            file_type='sales',
            total_rows=result.total_rows,
            error_rows=distinct_invalid,
            summary=result.summary,
            records=result.records,
            product_averages=result.product_averages,
        )

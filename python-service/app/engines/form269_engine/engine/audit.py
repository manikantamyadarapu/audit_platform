"""Form 269SS / 269ST combined audit."""

from __future__ import annotations

from time import perf_counter
from typing import Any

from app.engines.form269_engine.engine.calculator import aggregate_file_rows, build_form_records
from app.engines.form269_engine.engine.output import build_form269_response
from app.engines.form269_engine.parsers.master_loader import extract_lender_name, load_bundled_master_records
from app.engines.form269_engine.parsers.workbook_loader import load_form269_workbook
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError


class Form269Audit:
    """Process ledger files from an input folder and produce 269SS and 269ST rows."""

    def __init__(self) -> None:
        self._log = get_logger()

    def process(
        self,
        input_files: list[tuple[str, bytes]],
    ) -> dict[str, Any]:
        if not input_files:
            raise ValueError('At least one input Excel file is required')

        start = perf_counter()
        master_records = load_bundled_master_records()

        records_269ss: list[dict[str, Any]] = []
        records_269st: list[dict[str, Any]] = []
        file_summaries: list[dict[str, Any]] = []
        total_rows = 0

        for file_name, file_bytes in input_files:
            if not file_bytes:
                self._log.warning('Skipping empty file: %s', file_name)
                continue

            lender_name = extract_lender_name(file_name)
            try:
                loaded = load_form269_workbook(file_bytes, file_name, log=self._log)
            except SheetValidationError:
                raise
            except Exception as exc:
                raise ValueError(f'Invalid or unreadable Excel file ({file_name})') from exc

            rows = loaded.dataframe.to_dicts()
            total_rows += len(rows)
            totals = aggregate_file_rows(rows)

            ss_rows = build_form_records(
                lender_name=lender_name,
                totals=totals,
                master_records=master_records,
                use_credit=True,
            )
            st_rows = build_form_records(
                lender_name=lender_name,
                totals=totals,
                master_records=master_records,
                use_credit=False,
            )
            records_269ss.extend(ss_rows)
            records_269st.extend(st_rows)

            file_summaries.append(
                {
                    'fileName': file_name,
                    'lenderName': lender_name,
                    'transactionRows': len(rows),
                    'outputRows269SS': len(ss_rows),
                    'outputRows269ST': len(st_rows),
                }
            )

            self._log.info(
                f'Form 269 processed {file_name} ({lender_name}): '
                f'ss={len(ss_rows)} st={len(st_rows)}'
            )

        processing_ms = (perf_counter() - start) * 1000
        return build_form269_response(
            records_269ss=records_269ss,
            records_269st=records_269st,
            file_summaries=file_summaries,
            total_input_files=len(input_files),
            total_transaction_rows=total_rows,
            processing_ms=processing_ms,
        )

"""Sales ledger: header-row detection + sales account ↔ product + gross weights."""

from collections import Counter, defaultdict
from typing import Any

import pandas as pd

from app.config.settings import get_settings
from app.processors.base import BaseProcessor
from app.utils.excel_header_detection import find_header_row_index, load_excel_with_header_row
from app.utils.excel_reader import ExcelReader
from app.utils.product_classifier import classify_product_cached, expected_category_from_sales_account
from app.utils.response_builder import build_processing_response
from app.utils.sheet_validation_error import SheetValidationError

_EMPTY_TOKENS = frozenset(
    {'', 'pending', 'na', 'n/a', 'none', 'null', 'nan', '-', '----'}
)

_REQUIRED = frozenset(
    {'voucher_no', 'sales_account', 'product', 'manual_gross_wt', 'auto_gross_wt'}
)

_SALES_HEADER_CORE = frozenset({'voucher_no', 'sales_account', 'product'})


def _sales_header_row_matches(labels: set[str]) -> bool:
    if not _SALES_HEADER_CORE <= labels:
        return False
    mg = 'manual_gross_wt' in labels or 'manual_gross_weight' in labels
    ag = 'auto_gross_wt' in labels or 'auto_gross_weight' in labels
    return mg and ag


class SalesAuditProcessor(BaseProcessor):
    """Columns are matched by normalized names (never by Excel letters)."""

    def __init__(self) -> None:
        self.reader = ExcelReader()
        self._settings = get_settings()

    def process(self, file_bytes: bytes) -> dict[str, Any]:
        df, header_row_index = self._read_sales_df(file_bytes)
        df = self._canonicalize_sales_weight_columns(df)
        missing = _REQUIRED - set(df.columns)
        if missing:
            found = sorted(c for c in df.columns if str(c).strip())
            header_excel = None if header_row_index is None else int(header_row_index) + 1
            raise SheetValidationError(
                f"Missing required columns after header detection: {', '.join(sorted(missing))}",
                code='MISSING_REQUIRED_COLUMNS',
                missingColumns=sorted(missing),
                foundColumns=found,
                headerRowExcel=header_excel,
                expectedColumns=sorted(_REQUIRED),
                hints=[
                    'The service matches columns by normalized names (not Excel letters). '
                    'Examples: "Voucher No" → voucher_no, "Manual Gross Wt." → manual_gross_wt, '
                    '"Manual Gross Weight" → manual_gross_weight (accepted as alias).',
                    'There must be a single header row listing all five fields; preamble rows '
                    '("Sales Report", date range, etc.) above that row are OK.',
                    'If foundColumns is empty or wrong, the detected header row may be incorrect — '
                    'put titles on one contiguous row.',
                ],
            )

        tol = float(self._settings.gross_weight_tolerance)
        dominance = self._dominant_accounts_by_product(df)

        uniq_products = self._uniq_normalized_strings(df, 'product')
        uniq_accounts = self._uniq_normalized_strings(df, 'sales_account')
        prod_pred_map = {k: classify_product_cached(k if k else '') for k in uniq_products}
        acc_exp_map = {
            acc: expected_category_from_sales_account(acc if acc else '') if acc else None
            for acc in uniq_accounts
        }

        records: list[dict[str, Any]] = []
        skipped_no_rule = 0
        category_breakdown: Counter[str] = Counter()
        sales_product_issues = 0
        conflicting_account_rows = 0
        gross_weight_mismatches = 0

        data_rows = 0
        for idx, row in df.iterrows():
            if self._is_blank_row(row):
                continue
            data_rows += 1

            voucher_raw = row.get('voucher_no')
            sales_raw = row.get('sales_account')
            prod_raw = row.get('product')
            manual_cell = row.get('manual_gross_wt')
            auto_cell = row.get('auto_gross_wt')

            voucher = self._clean_str(voucher_raw)
            sales_text = self._normalize_blankable(sales_raw)
            prod_text = self._normalize_blankable(prod_raw)

            pk = prod_text or ''
            predicted_category, used_fuzzy = prod_pred_map[pk]
            category_breakdown[predicted_category or 'unknown'] += 1

            sk = sales_text or ''
            expected_sa_category = acc_exp_map[sk]

            weight_issue = False
            man_w = self._parse_weight(manual_cell)
            auto_w = self._parse_weight(auto_cell)
            if man_w is not None and auto_w is not None and abs(man_w - auto_w) > tol:
                weight_issue = True
                gross_weight_mismatches += 1

            issues: list[str] = []

            if expected_sa_category is None:
                skipped_no_rule += 1
            else:
                if predicted_category is None:
                    issues.append('MISSING_PRODUCT_CATEGORY_FOR_VALIDATION')
                    sales_product_issues += 1
                elif predicted_category != expected_sa_category:
                    issues.append('PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT')
                    sales_product_issues += 1

            if prod_text:
                key = prod_text.casefold().strip()
                mode = dominance.get(key)
                if mode is not None:
                    canon = sales_text.casefold().strip() if sales_text else ''
                    if canon and canon != mode:
                        issues.append('CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT')
                        conflicting_account_rows += 1

            if weight_issue:
                issues.append('GROSS_WEIGHT_OUTSIDE_TOLERANCE')

            if weight_issue:
                pass  # already counted gross_weight_mismatches

            if issues:
                records.append(
                    {
                        'rowNumber': int(idx) + header_row_index + 2,
                        'voucherNo': voucher,
                        'salesAccount': sales_text or '',
                        'product': prod_text or '',
                        'expectedSalesAccountCategory': expected_sa_category or '',
                        'predictedCategory': predicted_category or '',
                        'usedFuzzyClassification': bool(used_fuzzy),
                        'manualGrossWt': manual_cell if man_w is None else man_w,
                        'autoGrossWt': auto_cell if auto_w is None else auto_w,
                        'issues': issues,
                    }
                )

        summary = {
            'categoryBreakdown': dict(sorted(category_breakdown.items())),
            'skippedNoRule': skipped_no_rule,
            'salesAccountProductMismatches': sales_product_issues,
            'conflictingSalesAccountForProduct': conflicting_account_rows,
            'grossWeightMismatches': gross_weight_mismatches,
        }

        return build_processing_response(
            file_type='sales',
            total_rows=data_rows,
            error_rows=len(records),
            summary=summary,
            records=records,
        )

    def _read_sales_df(self, file_bytes: bytes) -> tuple[pd.DataFrame, int]:
        """
        Prefer header-row scan before a full-sheet read — many exports have preamble rows,
        which would force a redundant second pandas load if we defaulted to header=0.
        """
        header_row_index = find_header_row_index(file_bytes, _sales_header_row_matches, scan_limit=100)
        if header_row_index is not None:
            return load_excel_with_header_row(file_bytes, header_row_index), header_row_index

        dataframe = self.reader.read_excel(file_bytes)
        return dataframe, 0

    def _canonicalize_sales_weight_columns(self, dataframe: pd.DataFrame) -> pd.DataFrame:
        renames = {}
        if 'manual_gross_weight' in dataframe.columns and 'manual_gross_wt' not in dataframe.columns:
            renames['manual_gross_weight'] = 'manual_gross_wt'
        if 'auto_gross_weight' in dataframe.columns and 'auto_gross_wt' not in dataframe.columns:
            renames['auto_gross_weight'] = 'auto_gross_wt'
        return dataframe.rename(columns=renames) if renames else dataframe

    def _uniq_normalized_strings(self, dataframe: pd.DataFrame, column: str) -> set[str]:
        out: set[str] = {''}
        if column not in dataframe.columns:
            return out
        for cell in dataframe[column].tolist():
            norm = self._normalize_blankable(cell)
            out.add(norm or '')
        return out

    def _dominant_accounts_by_product(self, df: pd.DataFrame) -> dict[str, str]:
        buckets: defaultdict[str, list[str]] = defaultdict(list)

        for _, row in df.iterrows():
            if self._is_blank_row(row):
                continue
            prod = self._normalize_blankable(row.get('product'))
            sale = self._normalize_blankable(row.get('sales_account'))
            if not prod or not sale:
                continue
            key = prod.casefold().strip()
            buckets[key].append(sale.casefold().strip())

        dominant: dict[str, str] = {}
        for key, vals in buckets.items():
            ctr = Counter(vals)
            common = ctr.most_common(2)
            if len(common) == 1:
                dominant[key] = common[0][0]
            elif len(common) == 2 and common[0][1] > common[1][1]:
                dominant[key] = common[0][0]
            else:
                continue
        return dominant

    def _parse_weight(self, value: Any) -> float | None:
        if value is None or (isinstance(value, float) and pd.isna(value)):
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        low = text.lower()
        if not text or low in _EMPTY_TOKENS:
            return None
        try:
            cleaned = low.replace(',', '')
            return float(cleaned)
        except ValueError:
            return None

    def _normalize_blankable(self, value: Any) -> str | None:
        if value is None or pd.isna(value):
            return None
        text = str(value).strip()
        if not text:
            return None
        if text.lower() in _EMPTY_TOKENS:
            return None
        return text

    def _clean_str(self, value: Any) -> str:
        if value is None or pd.isna(value):
            return ''
        return str(value).strip()

    def _is_blank_row(self, row: pd.Series) -> bool:
        for value in row.values:
            if self._normalize_blankable(value) is not None:
                return False
        return True

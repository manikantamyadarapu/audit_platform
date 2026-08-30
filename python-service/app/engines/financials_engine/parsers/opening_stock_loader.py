"""Load Opening Stock inputs: Quantity file + Previous Year Closing Stock product amounts."""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd
from openpyxl import load_workbook

from app.engines.financials_engine.engine.opening_stock import norm_opening_product_name
from app.engines.financials_engine.parsers.workbook_loader import parse_numeric_value
from app.utils.header_cleaner import normalize_header
from app.utils.logger import get_logger
from app.utils.sheet_validation_error import SheetValidationError

HEADER_SCAN_LIMIT = 40

QTY_PRODUCT_ALIASES = frozenset(
    {'product', 'particulars_product', 'particulars', 'item', 'item_name'}
)
QTY_OPENING_ALIASES = frozenset(
    {
        'opening_balance',
        'opening_qty',
        'opening_quantity',
        'opening_stock_qty',
        'op_bal',
        'opening',
    }
)

PARTICULARS_ALIASES = frozenset(
    {
        'particulars',
        'particulars_product',
        'product',
        'narration',
        'description',
        'item',
    }
)
CLOSING_STOCK_HEADER_ALIASES = frozenset(
    {
        'closing_stock',
        'closing_balance',
        'closing',
        'cls_stock',
        'closing_stk',
    }
)
SKIP_ROW_LABELS = frozenset(
    {
        'total',
        'grand_total',
        'sub_total',
        'subtotal',
        'particulars',
    }
)
# Workbook sheets that are financial statements — never scanned for product closing.
NON_STOCK_SHEET_HINTS = frozenset(
    {
        'balance sheet',
        'cash flow',
        'profit',
        'itr',
        'deferred tax',
        'depreciation',
        't shape',
        'trading',
        'abstract',
        'salary',
        'fixed assets',
        'adv frm',
        's crs',
        'bs ann',
        'pl ann',
        'sheet2',
        'bs',
        'pl',
        'cashflow',
        'dep co',
        'dep it',
        'def tax',
    }
)


def _display_product_name(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ''
    return str(value).replace('\n', ' ').replace('\r', ' ').strip()


def _labels_from_row(row: pd.Series | list[Any]) -> dict[int, str]:
    cells = row.tolist() if hasattr(row, 'tolist') else list(row)
    mapping: dict[int, str] = {}
    for idx, cell in enumerate(cells):
        label = normalize_header(cell)
        if label:
            mapping[idx] = label
    return mapping


def _find_header(
    raw: pd.DataFrame,
    *,
    product_aliases: frozenset[str],
    required_aliases: dict[str, frozenset[str]],
    source_label: str,
) -> tuple[int, dict[str, int]]:
    scan = min(HEADER_SCAN_LIMIT, len(raw.index))
    best: tuple[int, dict[str, int], int] | None = None

    for idx in range(scan):
        labels = _labels_from_row(raw.iloc[idx])
        if not labels:
            continue
        col_map: dict[str, int] = {}
        for col_idx, label in labels.items():
            if label in product_aliases and 'product' not in col_map:
                col_map['product'] = col_idx
            for key, aliases in required_aliases.items():
                if label in aliases and key not in col_map:
                    col_map[key] = col_idx
        score = len(col_map)
        needed = 1 + len(required_aliases)
        if score >= needed and 'product' in col_map:
            return idx, col_map
        if best is None or score > best[2]:
            best = (idx, col_map, score)

    missing = []
    if best is None or 'product' not in best[1]:
        missing.append('Product / Particulars')
    for key in required_aliases:
        if best is None or key not in best[1]:
            missing.append(key.replace('_', ' ').title())
    raise SheetValidationError(
        f'{source_label}: could not find required headers ({", ".join(missing)}). '
        f'Scan the first {HEADER_SCAN_LIMIT} rows for column names.',
        code='MISSING_COLUMNS',
        source=source_label,
        missingColumns=missing,
    )


def load_opening_quantity_workbook(
    file_bytes: bytes,
    file_name: str,
) -> list[dict[str, Any]]:
    """Current Year Opening Quantity File — Product + Opening Balance required."""
    try:
        raw = pd.read_excel(BytesIO(file_bytes), header=None, dtype=object)
    except Exception as exc:
        raise SheetValidationError(
            f'Opening Quantity file unreadable ({file_name}): {exc}',
            code='UNREADABLE_FILE',
            fileName=file_name,
            source='Opening Quantity',
        ) from exc

    if raw.empty:
        raise SheetValidationError(
            f'Opening Quantity file is empty ({file_name})',
            code='EMPTY_FILE',
            fileName=file_name,
            source='Opening Quantity',
        )

    header_idx, col_map = _find_header(
        raw,
        product_aliases=QTY_PRODUCT_ALIASES,
        required_aliases={'opening_balance': QTY_OPENING_ALIASES},
        source_label='Opening Quantity file',
    )

    optional_aliases = {
        'sku': frozenset({'sku', 'item_code', 'code'}),
        'receipts': frozenset({'receipts', 'receipt'}),
        'issues': frozenset({'issues', 'issue'}),
        'closing_balance': frozenset(
            {'closing_balance', 'closing_qty', 'closing_quantity', 'closing'}
        ),
    }
    labels = _labels_from_row(raw.iloc[header_idx])
    for key, aliases in optional_aliases.items():
        if key in col_map:
            continue
        for col_idx, label in labels.items():
            if label in aliases:
                col_map[key] = col_idx
                break

    rows: list[dict[str, Any]] = []
    for ridx in range(header_idx + 1, len(raw.index)):
        series = raw.iloc[ridx]
        product = _display_product_name(series.iloc[col_map['product']])
        if not product:
            continue
        entry: dict[str, Any] = {
            'product': product,
            'openingBalance': parse_numeric_value(series.iloc[col_map['opening_balance']]),
        }
        if 'sku' in col_map:
            entry['sku'] = _display_product_name(series.iloc[col_map['sku']])
        if 'receipts' in col_map:
            entry['receipts'] = parse_numeric_value(series.iloc[col_map['receipts']])
        if 'issues' in col_map:
            entry['issues'] = parse_numeric_value(series.iloc[col_map['issues']])
        if 'closing_balance' in col_map:
            entry['closingBalance'] = parse_numeric_value(series.iloc[col_map['closing_balance']])
        rows.append(entry)
    return rows


def _is_non_stock_sheet(sheet_name: str) -> bool:
    low = str(sheet_name or '').strip().casefold()
    if not low:
        return True
    for hint in NON_STOCK_SHEET_HINTS:
        if hint == low or hint in low:
            return True
    return False


def _is_skip_product_label(product: str) -> bool:
    key = normalize_header(product)
    if not key:
        return True
    if key in SKIP_ROW_LABELS:
        return True
    if key.startswith('total') or key.startswith('grand_total'):
        return True
    # Sub-header row markers like "1" / "2 (Qty)" under Particulars.
    if key.isdigit():
        return True
    # Section titles / company preamble noise.
    junk_bits = (
        'jewellers',
        'hyderabad',
        'basheerbagh',
        'cin_',
        'details_of_jewels',
        'ay_',
    )
    if any(bit in key for bit in junk_bits):
        return True
    return False


def _register_product_keys(index: dict[str, dict[str, Any]], entry: dict[str, Any]) -> None:
    from app.engines.financials_engine.engine.opening_stock import product_sheet_lookup_keys

    product = str(entry.get('product') or '')
    for key in product_sheet_lookup_keys(product):
        if key not in index:
            index[key] = entry


def _detect_closing_stock_columns(
    raw: pd.DataFrame,
) -> tuple[int, int, int] | None:
    """
    Return (header_row_index, particulars_col, closing_amount_col).

    Handles two-row headers where row N has 'Closing stock' and row N+1 has Qty / Amt.
    Closing Amount is the Amt column under Closing stock (usually closing_col + 1).
    """
    scan = min(HEADER_SCAN_LIMIT, len(raw.index))
    for idx in range(scan):
        labels = _labels_from_row(raw.iloc[idx])
        if not labels:
            continue
        particulars_col: int | None = None
        closing_col: int | None = None
        for col_idx, label in labels.items():
            if particulars_col is None and label in PARTICULARS_ALIASES:
                particulars_col = col_idx
            if closing_col is None and label in CLOSING_STOCK_HEADER_ALIASES:
                closing_col = col_idx
        if particulars_col is None or closing_col is None:
            continue

        amount_col = closing_col + 1
        # Prefer explicit Amt. sub-header in the next row under Closing stock.
        if idx + 1 < len(raw.index):
            sub = list(raw.iloc[idx + 1].tolist())
            for offset in (1, 0, 2):
                cidx = closing_col + offset
                if cidx >= len(sub):
                    continue
                sub_label = normalize_header(sub[cidx])
                if 'amt' in sub_label or sub_label.endswith('amount'):
                    amount_col = cidx
                    break

        return idx, particulars_col, amount_col
    return None


def _extract_products_from_closing_stock_sheet(
    raw: pd.DataFrame,
    *,
    sheet_name: str,
) -> dict[str, dict[str, Any]]:
    """
    Extract per-product Closing Stock Amount from a category Closing Stock sheet
    (e.g. Dia / Eme). Skips TOTAL and blank/section header rows.
    """
    detected = _detect_closing_stock_columns(raw)
    if detected is None:
        return {}

    header_idx, particulars_col, amount_col = detected
    # Qty is typically the Closing stock header column itself.
    qty_col = amount_col - 1 if amount_col > particulars_col else None

    products: dict[str, dict[str, Any]] = {}
    for ridx in range(header_idx + 1, len(raw.index)):
        cells = list(raw.iloc[ridx].tolist())
        if particulars_col >= len(cells):
            continue
        product = _display_product_name(cells[particulars_col])
        if not product or _is_skip_product_label(product):
            continue

        amount = parse_numeric_value(cells[amount_col]) if amount_col < len(cells) else None
        qty = None
        if qty_col is not None and 0 <= qty_col < len(cells):
            qty = parse_numeric_value(cells[qty_col])

        # Section headers (e.g. "Diamonds - Beads") have no measures — skip.
        if amount is None and qty is None:
            continue

        key = norm_opening_product_name(product)
        if not key:
            continue

        products[key] = {
            'product': product,
            'sheetName': sheet_name,
            'closingStockAmount': amount,
            'closingStockQty': qty,
            'found': amount is not None,
            'excelRow': ridx + 1,
            'reason': None if amount is not None else 'closing_balance_amount_missing',
        }
    return products


def load_previous_year_product_sheets(
    file_bytes: bytes,
    file_name: str,
    *,
    log: Any | None = None,
) -> dict[str, dict[str, Any]]:
    """
    Previous Year Closing Stock workbook → product name index.

    Scans Closing Stock category sheets (Dia, Eme, Prls, Rubi, Prec, …) and indexes
    each product row's Closing stock Amount. Does not use sheet TOTAL rows.
    Financial-statement sheets are skipped.
    """
    logger = log or get_logger()
    try:
        workbook = load_workbook(BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception as exc:
        raise SheetValidationError(
            f'Previous Year Closing Stock file unreadable ({file_name}): {exc}',
            code='UNREADABLE_FILE',
            fileName=file_name,
            source='Previous Year Closing Stock',
        ) from exc

    sheet_names = list(workbook.sheetnames)
    if not sheet_names:
        workbook.close()
        raise SheetValidationError(
            f'Previous Year Closing Stock file has no sheets ({file_name})',
            code='EMPTY_FILE',
            fileName=file_name,
            source='Previous Year Closing Stock',
        )

    index: dict[str, dict[str, Any]] = {}
    scanned_sheets: list[str] = []
    seen_products: set[str] = set()

    try:
        for sheet_name in sheet_names:
            display_name = str(sheet_name or '').strip()
            if _is_non_stock_sheet(display_name):
                continue

            try:
                ws = workbook[sheet_name]
                rows = list(ws.iter_rows(values_only=True))
            except Exception as exc:
                logger.warning(
                    'Previous Year sheet unreadable: sheet={} error={}',
                    display_name,
                    exc,
                )
                continue

            if not rows:
                continue

            raw = pd.DataFrame(rows)
            extracted = _extract_products_from_closing_stock_sheet(
                raw,
                sheet_name=display_name,
            )
            if not extracted:
                continue

            scanned_sheets.append(display_name)
            for entry in extracted.values():
                product_key = norm_opening_product_name(str(entry.get('product') or ''))
                if product_key and product_key not in seen_products:
                    seen_products.add(product_key)
                _register_product_keys(index, entry)
    finally:
        workbook.close()

    logger.info(
        'Previous Year Closing Stock indexed: file={} sheets_scanned={} products={}',
        file_name,
        scanned_sheets,
        len(seen_products),
    )
    if not seen_products:
        logger.warning(
            'Previous Year Closing Stock contained no product Closing stock amounts ({})',
            file_name,
        )
    return index


def load_previous_year_closing_workbook(
    file_bytes: bytes,
    file_name: str,
) -> list[dict[str, Any]]:
    """Deprecated list view of the product closing index."""
    index = load_previous_year_product_sheets(file_bytes, file_name)
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for entry in index.values():
        product = str(entry.get('product') or '')
        key = norm_opening_product_name(product)
        if not key or key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                'product': entry.get('product'),
                'sheetName': entry.get('sheetName'),
                'closingStockQty': entry.get('closingStockQty'),
                'closingStockAmount': entry.get('closingStockAmount'),
                'found': entry.get('found'),
            }
        )
    return rows

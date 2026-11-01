"""Read-only Gross Profit comparison for Closing Stock workbooks.

Generated and reference workbooks are opened for values only. Nothing is written
back, and Closing Stock calculations are not involved.
"""

from __future__ import annotations

import math
import re
from io import BytesIO
from pathlib import Path
from typing import Any, BinaryIO, Mapping

from openpyxl.workbook.workbook import Workbook
from openpyxl.worksheet.worksheet import Worksheet

from app.engines.financials_engine.engine.closing_stock_template import CLOSING_STOCK_CATEGORIES

# Sheet titles vary (DIA / PERALS / Precious). Canonical names stay the five
# Closing Stock categories. Trading and Abstract are never compared.
_SHEET_ALIASES: dict[str, str] = {
    'dia': 'Diamond',
    'diamond': 'Diamond',
    'diamonds': 'Diamond',
    'eme': 'Emerald',
    'emerald': 'Emerald',
    'emeralds': 'Emerald',
    'pearl': 'Pearls',
    'pearls': 'Pearls',
    'peral': 'Pearls',
    'perals': 'Pearls',
    'rubie': 'Rubie',
    'rubies': 'Rubie',
    'ruby': 'Rubie',
    'precious': 'Precious and Semi Precious',
    'precious and semi precious': 'Precious and Semi Precious',
    'precious semi precious': 'Precious and Semi Precious',
}
_EXCLUDED_SHEETS = frozenset({'trading', 'abstract'})
_SHEET_ORDER = {name: index for index, name in enumerate(CLOSING_STOCK_CATEGORIES)}

_AMOUNT_TOLERANCE = 1e-4
_PERCENT_TOLERANCE = 1e-6
# Sheet-level section titles differ by singular/plural ("Emerald" / "Emeralds").
# Subsection titles such as "diamonds beads" are left unchanged.
_CATEGORY_ALIASES = {
    'diamond': 'diamonds',
    'diamonds': 'diamonds',
    'emerald': 'emeralds',
    'emeralds': 'emeralds',
    'pearl': 'pearls',
    'pearls': 'pearls',
    'rubie': 'rubies',
    'rubies': 'rubies',
    'ruby': 'rubies',
}


def compare_gross_profit_workbooks(
    generated: bytes | BinaryIO | Path | str,
    reference: bytes | BinaryIO | Path | str,
    *,
    amount_tolerance: float = _AMOUNT_TOLERANCE,
    percent_tolerance: float = _PERCENT_TOLERANCE,
    generated_name: str = 'generated',
    reference_name: str = 'reference',
) -> dict[str, Any]:
    """Compare GP Amount and GP % on the five category sheets.

    Products match on normalized section and product name. Category totals and
    the sheet grand total are compared on their own and never as products.
    """
    generated_book = _open_workbook(generated)
    reference_book = _open_workbook(reference)
    try:
        return _compare_books(
            generated_book,
            reference_book,
            amount_tolerance=amount_tolerance,
            percent_tolerance=percent_tolerance,
            generated_name=generated_name,
            reference_name=reference_name,
        )
    finally:
        generated_book.close()
        reference_book.close()


def _open_workbook(source: bytes | BinaryIO | Path | str) -> Workbook:
    from openpyxl import load_workbook

    if isinstance(source, bytes):
        return load_workbook(BytesIO(source), data_only=True)
    if isinstance(source, (str, Path)):
        return load_workbook(Path(source), data_only=True)
    return load_workbook(source, data_only=True)


def _compare_books(
    generated_book: Workbook,
    reference_book: Workbook,
    *,
    amount_tolerance: float,
    percent_tolerance: float,
    generated_name: str,
    reference_name: str,
) -> dict[str, Any]:
    generated_sheets = _index_sheets(generated_book)
    reference_sheets = _index_sheets(reference_book)
    sheet_names = sorted(
        set(generated_sheets) | set(reference_sheets),
        key=lambda name: _SHEET_ORDER.get(name, len(_SHEET_ORDER)),
    )

    rows: list[dict[str, Any]] = []
    totals: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []

    for sheet in sheet_names:
        generated_ws = generated_sheets.get(sheet)
        reference_ws = reference_sheets.get(sheet)
        summary, sheet_rows, sheet_totals, sheet_missing, sheet_duplicates = _compare_sheet(
            sheet,
            generated_ws,
            reference_ws,
            amount_tolerance=amount_tolerance,
            percent_tolerance=percent_tolerance,
        )
        summaries.append(summary)
        rows.extend(sheet_rows)
        totals.extend(sheet_totals)
        missing.extend(sheet_missing)
        duplicates.extend(sheet_duplicates)

    return {
        'generatedWorkbook': generated_name,
        'referenceWorkbook': reference_name,
        'amountTolerance': amount_tolerance,
        'percentTolerance': percent_tolerance,
        'excludedSheets': ['Trading', 'Abstract'],
        'rows': rows,
        'totals': totals,
        'missingProducts': missing,
        'duplicateProducts': duplicates,
        'sheets': summaries,
    }


def _index_sheets(workbook: Workbook) -> dict[str, Worksheet]:
    indexed: dict[str, Worksheet] = {}
    for name in workbook.sheetnames:
        canonical = _canonical_sheet(name)
        if canonical is None or canonical in indexed:
            continue
        indexed[canonical] = workbook[name]
    return indexed


def _canonical_sheet(name: str) -> str | None:
    key = _norm_label(name)
    if not key or key in _EXCLUDED_SHEETS:
        return None
    return _SHEET_ALIASES.get(key)


def _compare_sheet(
    sheet: str,
    generated_ws: Worksheet | None,
    reference_ws: Worksheet | None,
    *,
    amount_tolerance: float,
    percent_tolerance: float,
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if generated_ws is None or reference_ws is None:
        missing_side = 'generated' if generated_ws is None else 'reference'
        present = reference_ws if generated_ws is None else generated_ws
        present_table = _read_sheet(present, sheet) if present is not None else {'products': [], 'totals': []}
        missing = [
            _missing_row(sheet, record, missing_side)
            for record in present_table.get('products') or []
        ]
        total_rows = [
            _missing_row(sheet, record, missing_side)
            for record in present_table.get('totals') or []
        ]
        summary = {
            'sheet': sheet,
            'generatedSheet': None if generated_ws is None else generated_ws.title,
            'referenceSheet': None if reference_ws is None else reference_ws.title,
            'matchedProducts': 0,
            'amountMismatches': 0,
            'percentageMismatches': 0,
            'missingProducts': len(missing),
            'missingSheet': missing_side,
            'totals': total_rows,
            'status': 'FAIL',
        }
        return summary, [], total_rows, missing, []

    generated_table = _read_sheet(generated_ws, sheet)
    reference_table = _read_sheet(reference_ws, sheet)
    if generated_table.get('error') or reference_table.get('error'):
        summary = {
            'sheet': sheet,
            'generatedSheet': generated_ws.title,
            'referenceSheet': reference_ws.title,
            'matchedProducts': 0,
            'amountMismatches': 0,
            'percentageMismatches': 0,
            'missingProducts': 0,
            'totals': [],
            'status': 'FAIL',
            'error': generated_table.get('error') or reference_table.get('error'),
        }
        return summary, [], [], [], []

    product_rows, product_missing, product_duplicates = _pair_records(
        sheet,
        generated_table['products'],
        reference_table['products'],
        amount_tolerance=amount_tolerance,
        percent_tolerance=percent_tolerance,
        generated_ratio=generated_table['percentIsRatio'],
        reference_ratio=reference_table['percentIsRatio'],
    )
    generated_totals = _sheet_totals_for_pairing(generated_table['totals'], reference_table['totals'])
    reference_totals = _sheet_totals_for_pairing(reference_table['totals'], generated_table['totals'])
    total_rows, total_missing, total_duplicates = _pair_records(
        sheet,
        generated_totals,
        reference_totals,
        amount_tolerance=amount_tolerance,
        percent_tolerance=percent_tolerance,
        generated_ratio=generated_table['percentIsRatio'],
        reference_ratio=reference_table['percentIsRatio'],
    )
    missing = product_missing
    reported_totals = total_rows + total_missing
    duplicates = product_duplicates + total_duplicates
    amount_mismatches = sum(1 for row in product_rows if row.get('amountStatus') == 'FAIL')
    percent_mismatches = sum(1 for row in product_rows if row.get('percentStatus') == 'FAIL')
    total_failures = [row for row in reported_totals if row['status'] != 'PASS']
    status = 'PASS'
    if amount_mismatches or percent_mismatches or missing or product_duplicates or total_failures or total_duplicates:
        status = 'FAIL'
    summary = {
        'sheet': sheet,
        'generatedSheet': generated_ws.title,
        'referenceSheet': reference_ws.title,
        'matchedProducts': len(product_rows),
        'amountMismatches': amount_mismatches,
        'percentageMismatches': percent_mismatches,
        'missingProducts': len(missing),
        'totals': reported_totals,
        'status': status,
    }
    return summary, product_rows, reported_totals, missing, duplicates


def _pair_records(
    sheet: str,
    generated_rows: list[dict[str, Any]],
    reference_rows: list[dict[str, Any]],
    *,
    amount_tolerance: float,
    percent_tolerance: float,
    generated_ratio: bool,
    reference_ratio: bool,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    generated_unique, generated_dups = _unique_records(generated_rows)
    reference_unique, reference_dups = _unique_records(reference_rows)
    duplicate_keys = set(generated_dups) | set(reference_dups)

    paired: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []
    duplicates: list[dict[str, Any]] = []

    for key in duplicate_keys:
        for source, group in (('generated', generated_dups.get(key, [])), ('reference', reference_dups.get(key, []))):
            for record in group:
                duplicates.append(_duplicate_row(sheet, record, source))
        # A duplicated name is not paired, so a single counterpart stays unmatched too.
        for record in generated_unique.get(key, []):
            duplicates.append(_duplicate_row(sheet, record, 'generated'))
        for record in reference_unique.get(key, []):
            duplicates.append(_duplicate_row(sheet, record, 'reference'))

    keys = [
        key for key in dict.fromkeys([*generated_unique.keys(), *reference_unique.keys()])
        if key not in duplicate_keys
    ]
    for key in keys:
        generated = generated_unique.get(key)
        reference = reference_unique.get(key)
        if generated and reference:
            paired.append(_comparison_row(
                sheet,
                generated[0],
                reference[0],
                amount_tolerance=amount_tolerance,
                percent_tolerance=percent_tolerance,
                generated_ratio=generated_ratio,
                reference_ratio=reference_ratio,
            ))
        elif generated:
            missing.append(_missing_row(sheet, generated[0], 'reference'))
        elif reference:
            missing.append(_missing_row(sheet, reference[0], 'generated'))
    return paired, missing, duplicates


def _sheet_totals_for_pairing(
    rows: list[dict[str, Any]],
    other_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """A lone TOTAL and a lone GRAND TOTAL are the same sheet total."""
    if len(rows) == 1 and len(other_rows) == 1:
        kinds = {rows[0]['kind'], other_rows[0]['kind']}
        if kinds == {'category_total', 'overall_total'}:
            aligned = dict(rows[0])
            aligned['categoryKey'] = 'sheet'
            aligned['productKey'] = 'sheet total'
            return [aligned]
    return rows


def _unique_records(
    rows: list[dict[str, Any]],
) -> tuple[dict[tuple[str, str], list[dict[str, Any]]], dict[tuple[str, str], list[dict[str, Any]]]]:
    grouped: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for row in rows:
        grouped.setdefault((row['categoryKey'], row['productKey']), []).append(row)
    unique = {key: group for key, group in grouped.items() if len(group) == 1}
    duplicates = {key: group for key, group in grouped.items() if len(group) > 1}
    return unique, duplicates


def _read_sheet(ws: Worksheet, sheet: str) -> dict[str, Any]:
    located = _locate_gp_columns(ws)
    if located is None:
        return {'error': f'{ws.title}: Gross Profit Amount and % headers were not found'}
    amt_col, pct_col, data_start, name_col, percent_is_ratio = located
    preamble = _preamble_labels(ws, name_col, data_start)
    products: list[dict[str, Any]] = []
    totals: list[dict[str, Any]] = []
    category_label = sheet
    category_raw = _norm_label(sheet)
    category_key = _category_match_key(category_raw)
    last_row = ws.max_row or data_start
    for row_index in range(data_start, last_row + 1):
        label = _cell_text(ws.cell(row=row_index, column=name_col).value)
        if not label:
            continue
        norm = _norm_label(label)
        amount = _number(ws.cell(row=row_index, column=amt_col).value)
        percent = _number(ws.cell(row=row_index, column=pct_col).value)
        repeated_title = norm in preamble and amount is None and percent is None and not _row_has_number(ws, row_index, name_col)
        if _is_header_label(norm) or repeated_title:
            continue
        total_kind = _total_kind(norm)
        if total_kind and amount is None and percent is None and not _row_has_number(ws, row_index, name_col):
            continue
        if total_kind == 'overall':
            record = _record(label, 'Overall', 'overall', amount, percent, 'overall_total')
            record['productKey'] = 'grand total'
            totals.append(record)
            continue
        if total_kind == 'category':
            record = _record(label, category_label, category_key, amount, percent, 'category_total')
            record['productKey'] = 'total'
            totals.append(record)
            continue
        if amount is None and percent is None and not _row_has_number(ws, row_index, name_col):
            category_label = label
            category_raw = norm
            category_key = _category_match_key(norm)
            continue
        record = _record(label, category_label, category_key, amount, percent, 'product')
        record['productKey'] = _product_match_key(record['productKey'], category_raw)
        products.append(record)
    return {
        'products': products,
        'totals': totals,
        'percentIsRatio': percent_is_ratio,
    }


def _record(
    label: str,
    category_label: str,
    category_key: str,
    amount: float | None,
    percent: float | None,
    kind: str,
) -> dict[str, Any]:
    return {
        'product': label,
        'productKey': _norm_label(label),
        'category': category_label,
        'categoryKey': category_key,
        'gpAmount': amount,
        'gpPercent': percent,
        'kind': kind,
    }


def _locate_gp_columns(
    ws: Worksheet,
) -> tuple[int, int, int, int, bool] | None:
    """Find GP Amt and GP % from header text. Column letters are not assumed."""
    found_row = found_col = None
    scan_rows = min(ws.max_row or 1, 25)
    scan_cols = min(ws.max_column or 1, 80)
    for row in range(1, scan_rows + 1):
        for col in range(1, scan_cols + 1):
            if _header_kind(ws.cell(row=row, column=col).value) == 'grossprofit':
                found_row, found_col = row, col
                break
        if found_row is not None:
            break
    if found_row is None or found_col is None:
        return None

    amt_col = pct_col = None
    header_rows = {found_row}
    for col in range(found_col, min(found_col + 4, scan_cols + 1)):
        group_kind = _header_kind(ws.cell(row=found_row, column=col).value)
        if col > found_col and group_kind not in {'', 'pct', 'amt', 'grossprofit'}:
            break
        for row in range(found_row, min(found_row + 6, scan_rows + 1)):
            kind = _header_kind(ws.cell(row=row, column=col).value)
            if not kind:
                continue
            header_rows.add(row)
            if kind == 'amt' and amt_col is None:
                amt_col = col
            elif kind == 'pct' and pct_col is None:
                pct_col = col
        if amt_col is not None and pct_col is not None:
            break
    if amt_col is None or pct_col is None:
        return None

    name_col = 1
    for row in range(1, min(found_row + 6, scan_rows + 1)):
        for col in range(1, 4):
            if 'particular' in _norm_label(ws.cell(row=row, column=col).value):
                name_col = col
                header_rows.add(row)
    data_start = max(header_rows) + 1
    if _is_number_header_row(ws, data_start, name_col):
        data_start += 1
    percent_is_ratio = _column_is_percent_format(ws, pct_col, data_start)
    return amt_col, pct_col, data_start, name_col, percent_is_ratio


def _column_is_percent_format(ws: Worksheet, column: int, data_start: int) -> bool:
    last = min(ws.max_row or data_start, data_start + 30)
    for row in range(max(1, data_start - 4), last + 1):
        fmt = str(ws.cell(row=row, column=column).number_format or '')
        if '%' in fmt:
            return True
    return False


def _is_number_header_row(ws: Worksheet, row: int, name_col: int) -> bool:
    if row > (ws.max_row or 0):
        return False
    label = _norm_label(ws.cell(row=row, column=name_col).value)
    if label and not label.isdigit():
        return False
    numbers = 0
    for col in range(name_col + 1, min((ws.max_column or 1) + 1, name_col + 40)):
        value = ws.cell(row=row, column=col).value
        if isinstance(value, str) and value.strip().isdigit():
            numbers += 1
        elif isinstance(value, (int, float)) and not isinstance(value, bool) and float(value).is_integer() and abs(float(value)) <= 80:
            numbers += 1
    return numbers >= 3


def _preamble_labels(ws: Worksheet, name_col: int, data_start: int) -> set[str]:
    labels: set[str] = set()
    for row in range(1, data_start):
        norm = _norm_label(ws.cell(row=row, column=name_col).value)
        if norm:
            labels.add(norm)
    return labels


def _row_has_number(ws: Worksheet, row: int, name_col: int) -> bool:
    last = min(ws.max_column or 1, name_col + 45)
    for col in range(name_col + 1, last + 1):
        if _number(ws.cell(row=row, column=col).value) is not None:
            return True
    return False


def _comparison_row(
    sheet: str,
    generated: dict[str, Any],
    reference: dict[str, Any],
    *,
    amount_tolerance: float,
    percent_tolerance: float,
    generated_ratio: bool,
    reference_ratio: bool,
) -> dict[str, Any]:
    amount_status = 'PASS' if _within(generated['gpAmount'], reference['gpAmount'], amount_tolerance) else 'FAIL'
    percent_status = 'PASS' if _within(generated['gpPercent'], reference['gpPercent'], percent_tolerance) else 'FAIL'
    status = 'PASS' if amount_status == 'PASS' and percent_status == 'PASS' else 'FAIL'
    ratio = generated_ratio or reference_ratio or _looks_like_ratio(generated['gpPercent'], reference['gpPercent'])
    return {
        'sheet': sheet,
        'category': generated.get('category') or reference.get('category'),
        'product': generated.get('product') or reference.get('product'),
        'rowKind': generated.get('kind') or reference.get('kind'),
        'generatedGpAmount': generated.get('gpAmount'),
        'referenceGpAmount': reference.get('gpAmount'),
        'amountDifference': _difference(generated.get('gpAmount'), reference.get('gpAmount')),
        'generatedGpPercent': generated.get('gpPercent'),
        'referenceGpPercent': reference.get('gpPercent'),
        'percentagePointDifference': _percentage_points(
            generated.get('gpPercent'),
            reference.get('gpPercent'),
            ratio=ratio,
        ),
        'amountStatus': amount_status,
        'percentStatus': percent_status,
        'status': status,
    }


def _missing_row(sheet: str, record: Mapping[str, Any], missing_from: str) -> dict[str, Any]:
    generated = record if missing_from == 'reference' else None
    reference = record if missing_from == 'generated' else None
    return {
        'sheet': sheet,
        'category': record['category'],
        'product': record['product'],
        'rowKind': record['kind'],
        'generatedGpAmount': None if generated is None else generated['gpAmount'],
        'referenceGpAmount': None if reference is None else reference['gpAmount'],
        'amountDifference': None,
        'generatedGpPercent': None if generated is None else generated['gpPercent'],
        'referenceGpPercent': None if reference is None else reference['gpPercent'],
        'percentagePointDifference': None,
        'amountStatus': 'MISSING',
        'percentStatus': 'MISSING',
        'status': 'MISSING_IN_REFERENCE' if missing_from == 'reference' else 'MISSING_IN_GENERATED',
        'missingFrom': missing_from,
    }


def _duplicate_row(sheet: str, record: Mapping[str, Any], source: str) -> dict[str, Any]:
    return {
        'sheet': sheet,
        'category': record['category'],
        'product': record['product'],
        'rowKind': record['kind'],
        'source': source,
        'generatedGpAmount': record['gpAmount'] if source == 'generated' else None,
        'referenceGpAmount': record['gpAmount'] if source == 'reference' else None,
        'status': 'DUPLICATE',
    }


def _within(left: float | None, right: float | None, tolerance: float) -> bool:
    if left is None and right is None:
        return True
    if left is None or right is None:
        return False
    return math.isclose(float(left), float(right), rel_tol=0.0, abs_tol=tolerance)


def _difference(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return float(left) - float(right)


def _looks_like_ratio(left: float | None, right: float | None) -> bool:
    values = [value for value in (left, right) if value is not None]
    return bool(values) and all(abs(value) <= 2 for value in values)


def _percentage_points(left: float | None, right: float | None, *, ratio: bool) -> float | None:
    if left is None or right is None:
        return None
    delta = float(left) - float(right)
    return delta * 100 if ratio else delta


def _total_kind(norm: str) -> str | None:
    if norm in {'grand total', 'overall total'}:
        return 'overall'
    if norm == 'total' or norm.startswith('total '):
        return 'category'
    return None


def _is_header_label(norm: str) -> bool:
    if not norm or norm.isdigit():
        return True
    if norm in {'particulars', 'particulars product'} or norm.startswith('particulars '):
        return True
    if norm.startswith('details of jewels'):
        return True
    if norm.startswith('financial year'):
        return True
    return False


def _header_kind(value: Any) -> str:
    token = re.sub(r'[^a-z%]+', '', _cell_text(value).casefold().replace('amount', 'amt'))
    if token in {'%', 'percent', 'percentage', 'pct'}:
        return 'pct'
    if token == 'amt':
        return 'amt'
    if token == 'grossprofit':
        return 'grossprofit'
    if token:
        return 'other'
    return ''


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        number = float(value)
        if not math.isfinite(number):
            return None
        return number
    text = str(value).strip().replace(',', '')
    if not text:
        return None
    percent = text.endswith('%')
    if percent:
        text = text[:-1].strip()
    try:
        number = float(text)
    except ValueError:
        return None
    if not math.isfinite(number):
        return None
    return number / 100 if percent else number


def _cell_text(value: Any) -> str:
    if value is None:
        return ''
    return str(value).strip()


def _category_match_key(norm: str) -> str:
    return _CATEGORY_ALIASES.get(norm, norm)


def _product_match_key(product_key: str, category_raw: str) -> str:
    """Drop a repeated section prefix and the space in codes such as FP 1 / FP1."""
    key = product_key
    parts = category_raw.split()
    forms = {category_raw, _category_match_key(category_raw)}
    for index in range(len(parts)):
        suffix = ' '.join(parts[index:])
        prefix = ' '.join(parts[:index + 1])
        forms.add(suffix)
        forms.add(prefix)
        forms.add(_category_match_key(suffix))
        forms.add(_category_match_key(prefix))
    for prefix in sorted(forms, key=len, reverse=True):
        if prefix and key.startswith(prefix + ' '):
            key = key[len(prefix) + 1:]
            break
    return re.sub(r'(?<=[a-z])\s+(?=\d)', '', key)


def _norm_label(value: Any) -> str:
    text = _cell_text(value).casefold().replace('&', ' and ')
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

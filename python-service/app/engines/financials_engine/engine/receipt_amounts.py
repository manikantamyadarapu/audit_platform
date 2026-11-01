"""Receipt Amount = Receipt Qty × the same product's Average Rate on the source branch.

Receipt quantities are left unchanged. MR/DC Gross Amount is not an input.
A receipt with no matching source-branch Average Rate is flagged and left blank.
"""

from __future__ import annotations

import copy
import json
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    _add_stock_section_totals,
    _coerce_measure,
    _display_product_measures,
    _total_measures_from_raw,
)
from app.engines.financials_engine.engine.opening_stock import (
    alnum_opening_product_key,
    norm_opening_product_name,
    product_identity_key,
)

_QTY_EPS = 1e-4

# qty field, amount field, sheet label
_RECEIPT_COLUMNS: tuple[tuple[str, str, str], ...] = (
    ('receiptsInternalQty', 'receiptsInternalAmt', 'Internal Stock Transfer'),
    ('receiptsJubileeHillsQty', 'receiptsJubileeHillsAmt', 'Jubilee Hills'),
    ('receiptsKokapetQty', 'receiptsKokapetAmt', 'Kokapet'),
)

_BRANCH_LABELS = {
    'basheerbagh': 'Basheerbagh',
    'jubileeHills': 'Jubilee Hills',
    'kokapet': 'Kokapet',
}


class _Ambiguous:
    pass


_AMBIGUOUS = _Ambiguous()


def normalize_destination_branch(destination: str | None) -> str:
    key = str(destination or '').strip()
    aliases = {
        'basheerbagh': 'basheerbagh',
        'kokapet': 'kokapet',
        'jubileeHills': 'jubileeHills',
        'jubilee-hills': 'jubileeHills',
        'jubilee_hills': 'jubileeHills',
        'jubileehills': 'jubileeHills',
    }
    return aliases.get(key) or aliases.get(key.lower()) or key


def receipt_source_branch(destination: str, qty_key: str) -> str:
    """Branch whose Financials Average Rate values this receipt column."""
    dest = normalize_destination_branch(destination)
    if dest == 'jubileeHills':
        if qty_key == 'receiptsJubileeHillsQty':
            return 'basheerbagh'
        if qty_key == 'receiptsKokapetQty':
            return 'kokapet'
        return 'jubileeHills'
    if dest == 'kokapet':
        if qty_key == 'receiptsJubileeHillsQty':
            return 'jubileeHills'
        if qty_key == 'receiptsKokapetQty':
            return 'basheerbagh'
        return 'kokapet'
    if qty_key == 'receiptsKokapetQty':
        return 'kokapet'
    if qty_key == 'receiptsJubileeHillsQty':
        return 'jubileeHills'
    return 'basheerbagh'


# Source-wise Receipt columns. Named Issue location still selects the destination
# branch; the Receipt column on that branch is the sending source, not a merged
# location bucket. Total Receipts (receiptsQty/Amt) is the only aggregate.
# Internal stays Internal on the processing branch. Jubilee Hills relabels the
# Jubilee Hills subgroup as Basheerbagh.
ISSUE_RECEIPT_DROPS: tuple[tuple[str, str, str, str, str, str], ...] = (
    (
        'basheerbagh',
        'issuesBanjaraHillsQty',
        'issuesBanjaraHillsAmt',
        'jubileeHills',
        'receiptsJubileeHillsQty',
        'receiptsJubileeHillsAmt',
    ),
    (
        'basheerbagh',
        'issuesKokapetQty',
        'issuesKokapetAmt',
        'kokapet',
        'receiptsKokapetQty',
        'receiptsKokapetAmt',
    ),
    (
        'jubileeHills',
        'issuesBanjaraHillsQty',
        'issuesBanjaraHillsAmt',
        'basheerbagh',
        'receiptsJubileeHillsQty',
        'receiptsJubileeHillsAmt',
    ),
    (
        'jubileeHills',
        'issuesKokapetQty',
        'issuesKokapetAmt',
        'kokapet',
        'receiptsJubileeHillsQty',
        'receiptsJubileeHillsAmt',
    ),
    (
        'kokapet',
        'issuesBanjaraHillsQty',
        'issuesBanjaraHillsAmt',
        'jubileeHills',
        'receiptsKokapetQty',
        'receiptsKokapetAmt',
    ),
    (
        'basheerbagh',
        'issuesInternalQty',
        'issuesInternalAmt',
        'basheerbagh',
        'receiptsInternalQty',
        'receiptsInternalAmt',
    ),
    (
        'kokapet',
        'issuesInternalQty',
        'issuesInternalAmt',
        'kokapet',
        'receiptsInternalQty',
        'receiptsInternalAmt',
    ),
    (
        'jubileeHills',
        'issuesInternalQty',
        'issuesInternalAmt',
        'jubileeHills',
        'receiptsInternalQty',
        'receiptsInternalAmt',
    ),
)


def _match_keys(name: str) -> list[str]:
    """Identity, then normalized name, then alphanumeric. Same product only."""
    keys: list[str] = []
    identity = product_identity_key(name)
    norm = norm_opening_product_name(name)
    alnum = alnum_opening_product_key(name)
    if identity:
        keys.append(f'id:{identity}')
    if norm:
        keys.append(f'norm:{norm}')
    if alnum:
        keys.append(f'alnum:{alnum}')
    return keys


def _quantize_rate(value: float) -> float:
    return float(
        Decimal(str(value)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
    )


def index_average_rates(
    rows: Sequence[Mapping[str, Any]] | None,
) -> dict[str, float | _Ambiguous]:
    """Map match keys to one Average Rate. Two different rates for one key are ambiguous."""
    index: dict[str, float | _Ambiguous] = {}
    for row in rows or ():
        product = str(row.get('product') or row.get('label') or '').strip()
        rate = _coerce_measure(row.get('averageRateAmt'))
        if not product or rate is None:
            continue
        quantized = _quantize_rate(rate)
        for key in _match_keys(product):
            current = index.get(key)
            if current is None:
                index[key] = rate
            elif current is _AMBIGUOUS:
                continue
            elif abs(_quantize_rate(float(current)) - quantized) > _QTY_EPS:
                index[key] = _AMBIGUOUS
    return index


def normalize_source_average_rates(payload: Any) -> dict[str, list[Mapping[str, Any]]]:
    if not isinstance(payload, dict):
        return {}
    normalized: dict[str, list[Mapping[str, Any]]] = {}
    for branch, rows in payload.items():
        if isinstance(rows, list):
            normalized[str(branch)] = list(rows)
        elif isinstance(rows, dict):
            normalized[str(branch)] = [
                {'product': product, 'averageRateAmt': rate}
                for product, rate in rows.items()
            ]
    return normalized


def normalize_receipt_rate_mappings(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, str):
        try:
            payload = json.loads(payload or '[]')
        except json.JSONDecodeError:
            return []
    if not isinstance(payload, list):
        return []
    mappings: list[dict[str, Any]] = []
    for row in payload:
        if not isinstance(row, dict):
            continue
        product = str(row.get('product') or '').strip()
        source = str(row.get('sourceBranch') or '').strip()
        if not product or not source:
            continue
        mappings.append(row)
    return mappings


def _mapped_rate(
    mappings: Sequence[Mapping[str, Any]],
    *,
    product: str,
    source_branch: str,
    category: str,
    indexes: Mapping[str, Mapping[str, float | _Ambiguous]],
) -> tuple[str, float | None]:
    for mapping in mappings:
        if str(mapping.get('product') or '').strip() != product:
            continue
        if str(mapping.get('sourceBranch') or '').strip() != source_branch:
            continue
        mapped_category = str(mapping.get('category') or '').strip()
        if category and mapped_category and mapped_category != category:
            continue
        rate = _coerce_measure(mapping.get('averageRateAmt'))
        if rate is not None:
            return 'ok', float(rate)
        source_product = str(mapping.get('sourceProduct') or '').strip()
        if source_product:
            return _lookup_rate(indexes.get(source_branch) or {}, source_product)
    return 'missing', None


def _lookup_rate(
    index: Mapping[str, float | _Ambiguous],
    product: str,
) -> tuple[str, float | None]:
    """Return ('ok', rate), ('missing', None), or ('ambiguous', None)."""
    saw_key = False
    for key in _match_keys(product):
        if key not in index:
            continue
        saw_key = True
        found = index[key]
        if found is _AMBIGUOUS:
            return 'ambiguous', None
        return 'ok', float(found)
    if saw_key:
        return 'ambiguous', None
    return 'missing', None


def _qty_times_rate(qty: float, rate: float) -> float:
    return float(Decimal(str(qty)) * Decimal(str(rate)))


def _apply_product_row(
    row: Mapping[str, Any],
    *,
    destination: str,
    indexes: Mapping[str, Mapping[str, float | _Ambiguous]],
    category: str,
    receipt_rate_mappings: Sequence[Mapping[str, Any]] | None = None,
) -> tuple[dict[str, float | None], list[dict[str, Any]]]:
    product = str(row.get('label') or '').strip()
    review: list[dict[str, Any]] = []
    opening_amt = _coerce_measure(row.get('openingAmt'))
    purchases_amt = _coerce_measure(row.get('purchasesAmt'))
    total_qty = _coerce_measure(row.get('totalQty'))

    columns: list[dict[str, Any]] = []
    for qty_key, amt_key, label in _RECEIPT_COLUMNS:
        qty = _coerce_measure(row.get(qty_key))
        columns.append(
            {
                'qty_key': qty_key,
                'amt_key': amt_key,
                'label': label,
                'qty': qty,
                'source': receipt_source_branch(destination, qty_key),
                'amount': None,
                'existing': _coerce_measure(row.get(amt_key)),
            }
        )

    external_amt = 0.0
    external_present = False
    own_qty = 0.0
    own_columns: list[dict[str, Any]] = []

    for column in columns:
        qty = column['qty']
        if qty is None:
            continue
        if abs(qty) <= _QTY_EPS:
            column['amount'] = 0.0
            continue
        if column['source'] == destination:
            own_qty += qty
            own_columns.append(column)
            continue
        status, rate = _lookup_rate(indexes.get(column['source']) or {}, product)
        if status != 'ok' or rate is None:
            mapped_status, mapped_rate = _mapped_rate(
                receipt_rate_mappings or (),
                product=product,
                source_branch=column['source'],
                category=category,
                indexes=indexes,
            )
            if mapped_status == 'ok' and mapped_rate is not None:
                status, rate = mapped_status, mapped_rate
        if status != 'ok' or rate is None:
            if column.get('existing') is not None:
                column['amount'] = column['existing']
                continue
            review.append(
                {
                    'product': product,
                    'category': category,
                    'column': column['label'],
                    'sourceBranch': column['source'],
                    'sourceBranchLabel': _BRANCH_LABELS.get(column['source'], column['source']),
                    'receiptQty': qty,
                    'reason': (
                        'No single Average Rate for this product in '
                        f'{_BRANCH_LABELS.get(column["source"], column["source"])} Financials'
                    ),
                }
            )
            continue
        column['amount'] = _qty_times_rate(qty, rate)
        external_amt += column['amount']
        external_present = True

    solved_rate: float | None = None
    if own_columns:
        other_qty = (total_qty or 0.0) - own_qty
        base_amt = (opening_amt or 0.0) + (purchases_amt or 0.0)
        if external_present:
            base_amt += external_amt
        if abs(other_qty) <= _QTY_EPS:
            for column in own_columns:
                review.append(
                    {
                        'product': product,
                        'category': category,
                        'column': column['label'],
                        'sourceBranch': destination,
                        'sourceBranchLabel': _BRANCH_LABELS.get(destination, destination),
                        'receiptQty': column['qty'],
                        'reason': (
                            'No Average Rate for this product in '
                            f'{_BRANCH_LABELS.get(destination, destination)} Financials'
                        ),
                    }
                )
        else:
            solved_rate = float(Decimal(str(base_amt)) / Decimal(str(other_qty)))
            for column in own_columns:
                column['amount'] = _qty_times_rate(column['qty'], solved_rate)

    raw: dict[str, float | None] = {
        'openingQty': _coerce_measure(row.get('openingQty')),
        'openingAmt': opening_amt,
        'purchasesQty': _coerce_measure(row.get('purchasesQty')),
        'purchasesAmt': purchases_amt,
        'salesQty': _coerce_measure(row.get('salesQty')),
        'salesAmt': _coerce_measure(row.get('salesAmt')),
        'receiptsQty': _coerce_measure(row.get('receiptsQty')),
        'issuesInternalQty': _coerce_measure(row.get('issuesInternalQty')),
        'issuesBanjaraHillsQty': _coerce_measure(row.get('issuesBanjaraHillsQty')),
        'issuesKokapetQty': _coerce_measure(row.get('issuesKokapetQty')),
    }
    amount_values: list[float | None] = []
    for column in columns:
        raw[column['qty_key']] = column['qty']
        raw[column['amt_key']] = column['amount']
        amount_values.append(column['amount'])
    if all(value is None for value in amount_values):
        raw['receiptsAmt'] = None
    else:
        raw['receiptsAmt'] = float(
            sum(Decimal(str(value or 0)) for value in amount_values)
        )

    valued = _add_stock_section_totals(raw)
    return valued, review


def _truthy_complete(value: Any) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes'}
    return bool(value)


_RECEIPT_QTY_KEYS = (
    'receiptsInternalQty',
    'receiptsJubileeHillsQty',
    'receiptsKokapetQty',
)


def _has_other_receipts(row: Mapping[str, Any]) -> bool:
    for key in _RECEIPT_QTY_KEYS:
        qty = _coerce_measure(row.get(key))
        if qty is not None and abs(qty) > _QTY_EPS:
            return True
    return False


def _pending_name_index(names: Any) -> dict[str, bool]:
    index: dict[str, bool] = {}
    if isinstance(names, dict):
        names = names.values()
    for name in names or ():
        text = str(name or '').strip()
        if not text:
            continue
        for key in _match_keys(text):
            index[key] = True
    return index


def _is_pending_product(product: str, pending_index: Mapping[str, bool]) -> bool:
    return any(key in pending_index for key in _match_keys(product))


def _index_issue_rows(
    layout: Mapping[str, Sequence[Mapping[str, Any]]] | None,
    qty_key: str,
    amt_key: str,
) -> dict[str, dict[str, Any] | _Ambiguous]:
    index: dict[str, dict[str, Any] | _Ambiguous] = {}
    for rows in (layout or {}).values():
        for row in rows or ():
            if str(row.get('kind') or '') != 'product':
                continue
            product = str(row.get('label') or '').strip()
            if not product:
                continue
            payload = {
                'product': product,
                'qty': _coerce_measure(row.get(qty_key)),
                'amt': _coerce_measure(row.get(amt_key)),
                'hasOtherReceipts': _has_other_receipts(row),
            }
            for key in _match_keys(product):
                current = index.get(key)
                if current is None:
                    index[key] = payload
                elif current is _AMBIGUOUS:
                    continue
                elif str(current.get('product') or '') != product:
                    index[key] = _AMBIGUOUS
    return index


def _lookup_issue(
    index: Mapping[str, dict[str, Any] | _Ambiguous],
    product: str,
) -> dict[str, Any] | None:
    for key in _match_keys(product):
        found = index.get(key)
        if found is None:
            continue
        if found is _AMBIGUOUS:
            return None
        return found
    return None


def _mapped_source_product(
    mappings: Sequence[Mapping[str, Any]],
    *,
    product: str,
    source_branch: str,
    category: str,
) -> str | None:
    for mapping in mappings:
        if str(mapping.get('product') or '').strip() != product:
            continue
        if str(mapping.get('sourceBranch') or '').strip() != source_branch:
            continue
        mapped_category = str(mapping.get('category') or '').strip()
        if category and mapped_category and mapped_category != category:
            continue
        source_product = str(mapping.get('sourceProduct') or '').strip()
        if source_product:
            return source_product
    return None


def apply_source_issue_receipts(
    layout_by_category: dict[str, list[dict[str, Any]]] | None,
    *,
    destination: str,
    source_issue_layouts: Any = None,
    source_opening_complete: Any = None,
    source_opening_pending: Any = None,
    receipt_rate_mappings: Any = None,
    source_transfer_lines: Any = None,
    destination_transfer_lines: Any = None,
) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
    """Set destination Receipt Qty from the source Issue Qty (replace, do not add).

    Receipt Amount is not copied here. Amounts are filled later from the source
    branch Average Rate. Destination MR/DC qty is kept on the review list.
    """
    from app.engines.financials_engine.engine.cross_branch_transfers import reconcile_direction

    destination = normalize_destination_branch(destination)
    layouts = copy.deepcopy(layout_by_category or {})
    sources = source_issue_layouts if isinstance(source_issue_layouts, dict) else {}
    complete = source_opening_complete if isinstance(source_opening_complete, dict) else {}
    pending_by_source = source_opening_pending if isinstance(source_opening_pending, dict) else {}
    mappings = normalize_receipt_rate_mappings(receipt_rate_mappings)
    source_lines = source_transfer_lines if isinstance(source_transfer_lines, dict) else {}
    dest_lines = destination_transfer_lines if isinstance(destination_transfer_lines, dict) else {}
    dest_mr_lines = dest_lines.get('mr') if isinstance(dest_lines, dict) else []
    review: list[dict[str, Any]] = []
    applied_keys: set[tuple[str, str, str]] = set()
    mr_snapshot: dict[tuple[int, str], float | None] = {}

    for source, issue_qty, issue_amt, dest, receipt_qty, receipt_amt in ISSUE_RECEIPT_DROPS:
        if dest != destination:
            continue
        source_layout = sources.get(source)
        if not isinstance(source_layout, dict):
            continue
        branch_complete = _truthy_complete(complete.get(source))
        pending_index = _pending_name_index(pending_by_source.get(source))
        index = _index_issue_rows(source_layout, issue_qty, issue_amt)
        if not index:
            continue
        source_dc = (source_lines.get(source) or {}).get('dc') if isinstance(source_lines.get(source), dict) else []
        for category, rows in layouts.items():
            for row in rows:
                if str(row.get('kind') or '') != 'product':
                    continue
                product = str(row.get('label') or '').strip()
                if not product:
                    continue
                mapped = _mapped_source_product(
                    mappings,
                    product=product,
                    source_branch=source,
                    category=str(category or ''),
                )
                lookup_name = mapped or product
                found = None
                ambiguous = False
                for key in _match_keys(lookup_name):
                    hit = index.get(key)
                    if hit is None:
                        continue
                    if hit is _AMBIGUOUS:
                        ambiguous = True
                        found = None
                        break
                    found = hit
                    break
                if ambiguous:
                    review.append(
                        {
                            'status': 'ambiguous',
                            'sourceBranch': source,
                            'destinationBranch': destination,
                            'product': product,
                            'party': '',
                            'sourceIssueQty': None,
                            'destinationMrQty': _coerce_measure(row.get(receipt_qty)),
                            'authoritativeReceiptQty': None,
                            'difference': None,
                            'receiptQtyField': receipt_qty,
                            'reason': 'Multiple source products match this receipt row',
                        }
                    )
                    continue
                if found is None:
                    continue
                source_name = str(found.get('product') or lookup_name)
                if _is_pending_product(source_name, pending_index):
                    continue
                dest_other = False
                for key in _RECEIPT_QTY_KEYS:
                    if key == receipt_qty:
                        continue
                    qty = _coerce_measure(row.get(key))
                    if qty is not None and abs(qty) > _QTY_EPS:
                        dest_other = True
                        break
                if (found.get('hasOtherReceipts') or dest_other) and not branch_complete:
                    continue
                source_qty = found.get('qty')
                if source_qty is None:
                    continue
                column_key = (id(row), receipt_qty)
                if column_key not in mr_snapshot:
                    mr_snapshot[column_key] = _coerce_measure(row.get(receipt_qty))
                dest_mr_qty = mr_snapshot[column_key]
                apply_key = (source, product, receipt_qty)
                if apply_key in applied_keys:
                    continue
                applied_keys.add(apply_key)
                row[receipt_qty] = float(source_qty)
                review.extend(
                    reconcile_direction(
                        source_branch=source,
                        destination_branch=destination,
                        source_issue_qty=source_qty,
                        destination_mr_qty=dest_mr_qty,
                        product=product,
                        source_dc_lines=source_dc or [],
                        destination_mr_lines=dest_mr_lines or [],
                        receipt_qty_field=receipt_qty,
                    )
                )
    return layouts, review


def apply_source_receipt_amounts(
    layout_by_category: dict[str, list[dict[str, Any]]] | None,
    *,
    destination: str,
    source_average_rates: Any = None,
    receipt_rate_mappings: Any = None,
) -> dict[str, Any]:
    """Fill every receipt amount on one branch and list products that need review."""
    destination = normalize_destination_branch(destination)
    layouts = copy.deepcopy(layout_by_category or {})
    supplied = normalize_source_average_rates(source_average_rates)
    mappings = normalize_receipt_rate_mappings(receipt_rate_mappings)
    indexes = {
        branch: index_average_rates(rows)
        for branch, rows in supplied.items()
    }
    review: list[dict[str, Any]] = []
    published: list[dict[str, Any]] = []

    for category, rows in list(layouts.items()):
        section_raw: list[dict[str, float | None]] = []
        all_raw: list[dict[str, float | None]] = []
        rebuilt: list[dict[str, Any]] = []
        for row in rows:
            kind = str(row.get('kind') or '')
            if kind == 'product':
                raw, flags = _apply_product_row(
                    row,
                    destination=destination,
                    indexes=indexes,
                    category=category,
                    receipt_rate_mappings=mappings,
                )
                display = _display_product_measures(raw)
                rebuilt.append(
                    {
                        'kind': 'product',
                        'label': row.get('label'),
                        'subcategory': row.get('subcategory'),
                        **display,
                    }
                )
                section_raw.append(raw)
                all_raw.append(raw)
                review.extend(flags)
                rate = _coerce_measure(raw.get('averageRateAmt'))
                if rate is not None and str(row.get('label') or '').strip():
                    published.append(
                        {
                            'product': str(row.get('label') or '').strip(),
                            'averageRateAmt': rate,
                        }
                    )
                continue
            if kind == 'subcategory_total':
                rebuilt.append(
                    {
                        'kind': 'subcategory_total',
                        'label': row.get('label'),
                        'subcategory': row.get('subcategory'),
                        **_total_measures_from_raw(section_raw),
                    }
                )
                section_raw = []
                continue
            if kind == 'grand_total':
                rebuilt.append(
                    {
                        'kind': 'grand_total',
                        'label': row.get('label') or 'GRAND TOTAL',
                        'subcategory': None,
                        **_total_measures_from_raw(all_raw),
                    }
                )
                continue
            rebuilt.append(dict(row))
        layouts[category] = rebuilt

    return {
        'layoutByCategory': layouts,
        'receiptAmountReview': review,
        'productAverageRates': published,
    }


def finalize_branch_financials(
    layout_by_category: dict[str, list[dict[str, Any]]] | None,
    *,
    destination: str,
    source_average_rates: Any = None,
    receipt_rate_mappings: Any = None,
    source_issue_layouts: Any = None,
    source_opening_complete: Any = None,
    source_opening_pending: Any = None,
    source_transfer_lines: Any = None,
    destination_transfer_lines: Any = None,
) -> dict[str, Any]:
    """Apply Phase 2 Issue→Receipt mapping, then fill amounts and derived measures."""
    layout, transfer_review = apply_source_issue_receipts(
        layout_by_category,
        destination=destination,
        source_issue_layouts=source_issue_layouts,
        source_opening_complete=source_opening_complete,
        source_opening_pending=source_opening_pending,
        receipt_rate_mappings=receipt_rate_mappings,
        source_transfer_lines=source_transfer_lines,
        destination_transfer_lines=destination_transfer_lines,
    )
    applied = apply_source_receipt_amounts(
        layout,
        destination=destination,
        source_average_rates=source_average_rates,
        receipt_rate_mappings=receipt_rate_mappings,
    )
    return {**applied, 'transferReview': transfer_review}

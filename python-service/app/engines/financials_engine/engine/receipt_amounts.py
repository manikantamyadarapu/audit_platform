"""Receipt Amount = Receipt Qty × the same product's Average Rate on the source branch.

Receipt quantities are left unchanged. MR/DC Gross Amount is not an input.
A receipt with no matching source-branch Average Rate is flagged and left blank.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.product_rule_book import (
    _add_closing_stock,
    _add_gross_profit,
    _add_gross_profit_pct,
    _add_issues_amounts,
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


def receipt_source_branch(destination: str, qty_key: str) -> str:
    """Branch whose Financials Average Rate values this receipt column.

    On the Jubilee Hills workbook the Jubilee Hills receipt column is labeled
    Basheerbagh, so that quantity uses the Basheerbagh Average Rate.
    """
    if qty_key == 'receiptsKokapetQty':
        return 'kokapet'
    if qty_key == 'receiptsJubileeHillsQty':
        if destination == 'jubileeHills':
            return 'basheerbagh'
        return 'jubileeHills'
    if destination == 'jubileeHills':
        return 'jubileeHills'
    return 'basheerbagh'


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
                index[key] = quantized
            elif current is _AMBIGUOUS:
                continue
            elif abs(float(current) - quantized) > _QTY_EPS:
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
    """Saved choices: this sheet product uses that source-branch product's rate."""
    if not isinstance(payload, list):
        return []
    rows: list[dict[str, Any]] = []
    for row in payload:
        if not isinstance(row, Mapping):
            continue
        product = str(row.get('product') or '').strip()
        source_product = str(row.get('sourceProduct') or '').strip()
        source = str(row.get('sourceBranch') or '').strip()
        if product and source_product and source:
            rows.append(dict(row))
    return rows


def _same_product_name(left: str, right: str) -> bool:
    if str(left or '').strip().lower() == str(right or '').strip().lower():
        return True
    left_key = product_identity_key(left)
    right_key = product_identity_key(right)
    return bool(left_key and left_key == right_key)


def _mapping_for(
    mappings: Sequence[Mapping[str, Any]],
    *,
    product: str,
    category: str,
    source: str,
) -> Mapping[str, Any] | None:
    for row in mappings:
        if str(row.get('sourceBranch') or '') != source:
            continue
        row_category = str(row.get('category') or '').strip()
        if row_category and category and row_category != category:
            continue
        if _same_product_name(str(row.get('product') or ''), product):
            return row
    return None


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
        source = receipt_source_branch(destination, qty_key)
        shown = label
        if destination == 'jubileeHills' and qty_key == 'receiptsJubileeHillsQty':
            shown = 'Basheerbagh'
        columns.append(
            {
                'qty_key': qty_key,
                'amt_key': amt_key,
                'label': shown,
                'qty': qty,
                'source': source,
                'amount': None,
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
        mapped = _mapping_for(
            receipt_rate_mappings or [],
            product=product,
            category=category,
            source=column['source'],
        )
        if mapped:
            status, rate = _lookup_rate(
                indexes.get(column['source']) or {},
                str(mapped.get('sourceProduct') or ''),
            )
            if status != 'ok' or rate is None:
                rate = _coerce_measure(mapped.get('averageRateAmt'))
                status = 'ok' if rate is not None else 'missing'
        else:
            status, rate = _lookup_rate(indexes.get(column['source']) or {}, product)
        if status != 'ok' or rate is None:
            review.append(
                {
                    'product': product,
                    'category': category,
                    'subcategory': row.get('subcategory'),
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
            solved_rate = _quantize_rate(base_amt / other_qty)
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
    if solved_rate is not None:
        valued['averageRateAmt'] = solved_rate
        valued = _add_gross_profit_pct(
            _add_gross_profit(_add_closing_stock(_add_issues_amounts(valued)))
        )
    return valued, review


def apply_source_receipt_amounts(
    layout_by_category: dict[str, list[dict[str, Any]]] | None,
    *,
    destination: str,
    source_average_rates: Any = None,
    receipt_rate_mappings: Any = None,
) -> dict[str, Any]:
    """Fill every receipt amount on one branch and list products that need review."""
    layouts = layout_by_category or {}
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

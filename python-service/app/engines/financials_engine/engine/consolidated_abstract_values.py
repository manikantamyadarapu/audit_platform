"""Consolidate branch Abstract sources into Consolidated Financials Abstract columns."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.engine.abstract_values import (
    ABSTRACT_ACCOUNT_ROWS,
    COLOR_STONE_PRODUCT_ROWS,
    _cy_gp_pct,
    abstract_measures_from_trading_source,
    empty_abstract_measures,
)
from app.engines.financials_engine.engine.metal_trading import (
    aggregate_metal_trading_totals,
    metal_gross_profit_amt,
    resolve_metal_trading_account,
)
from app.engines.financials_engine.engine.trading_template import (
    TRADING_ACCOUNT_SOURCE_CATEGORY,
    TRADING_METAL_ACCOUNTS,
    _grand_total_from_layout,
)

_METAL_BY_TITLE = {str(account['title']): account for account in TRADING_METAL_ACCOUNTS}

CONSOLIDATED_BRANCH_KEYS: tuple[str, ...] = ('basheerbagh', 'kokapet', 'jubileeHills')

# Consolidated heading → internal measure key.
CONSOLIDATED_MEASURE_KEYS: tuple[str, ...] = (
    'Opening Stock',
    'Purchases - Total',
    'Internal Transfer - Total',
    'Internal Consumption - Total',
    'Making Charges',
    'Sales - Total',
    'Closing Stock - Total',
    'Gross Profit',
    'CY G P %',
    'GP AY 2025-26',
    'Deviation',
)

_RECEIPT_QTY_KEYS = (
    'receiptsInternalQty',
    'receiptsJubileeHillsQty',
    'receiptsKokapetQty',
)
_RECEIPT_AMT_KEYS = (
    'receiptsInternalAmt',
    'receiptsJubileeHillsAmt',
    'receiptsKokapetAmt',
)
_ISSUE_QTY_KEYS = (
    'issuesInternalQty',
    'issuesBanjaraHillsQty',
    'issuesKokapetQty',
)
_ISSUE_AMT_KEYS = (
    'issuesInternalAmt',
    'issuesBanjaraHillsAmt',
    'issuesKokapetAmt',
)

# Consolidated Particulars label → layout subcategory names used by BH/Kokapet vs Jubilee Hills.
_DIAMOND_SUBCATEGORY_ALIASES: dict[str, tuple[str, ...]] = {
    'Diamonds - Black diamonds': (
        'Diamonds - Black diamonds',
        'Diamonds - Black Diamonds',
    ),
    'Diamonds - Beads': ('Diamonds - Beads',),
    'Diamonds Rosecut diamonds': (
        'Diamonds Rosecut diamonds',
        'Diamonds - Rosecut Diamonds',
    ),
    'Diamonds - Flat polki': (
        'Diamonds - Flat polki',
        'Diamonds - Flat Polki',
    ),
    'Uncut - diamonds': (
        'Uncut - diamonds',
        'Uncut - Diamonds',
    ),
    'Diamonds': ('Diamonds',),
}

_ACCOUNT_SECTION_LABELS: tuple[str, ...] = (
    'Gold Account 24K',
    'Gold Account 22K',
    'Gold Account 18K',
    'Gold Account 14K',
    'Platinum Account',
    'Gold Account Jadau',
    'Silver Account',
    'Diamonds Account',
    'Emeralds',
    'Pearls',
    'Rubies',
    'Color Stones Account',
)

_DIAMOND_ITEM_LABELS: tuple[str, ...] = (
    'Diamonds - Black diamonds',
    'Diamonds - Beads',
    'Diamonds Rosecut diamonds',
    'Diamonds - Flat polki',
    'Uncut - diamonds',
    'Diamonds',
)

UNMAPPED_ACCOUNT_REASONS: dict[str, str] = {
    'Platinum Account': (
        'Platinum Account has no Trading Account or Closing Stock mapping in branch Financials'
    ),
    'Gold Account Jadau': (
        'Gold Account Jadau is Opening-mapping only and has no Trading Account'
    ),
}

STATIC_UNRESOLVED: tuple[str, ...] = (
    'GP AY 2025-26: branch Closing Stock / Abstract outputs do not compute this column',
    'Deviation: requires GP AY 2025-26, which is not computed on branch outputs',
)

INCOMPLETE_BRANCHES_REASON = (
    'Values are not mapped until Basheerbagh, Kokapet, and Jubilee Hills Financials are all complete'
)


def empty_consolidated_measures() -> dict[str, dict[str, Any]]:
    return {key: {'qty': None, 'amt': None} for key in CONSOLIDATED_MEASURE_KEYS}


def build_consolidated_abstract_row_measures(
    branches: Mapping[str, Mapping[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, dict[str, Any]]], list[str], list[str]]:
    """
    Particulars label → consolidated column measures.

    Returns (by_label, contributing_branches, unresolved).
    """
    snapshots = _normalize_branches(branches)
    contributing = [name for name in CONSOLIDATED_BRANCH_KEYS if name in snapshots]
    unresolved: list[str] = []
    if len(contributing) < len(CONSOLIDATED_BRANCH_KEYS):
        missing = [name for name in CONSOLIDATED_BRANCH_KEYS if name not in snapshots]
        if not contributing:
            unresolved.append(
                'No completed Basheerbagh, Kokapet, or Jubilee Hills Financials results were sent'
            )
        else:
            unresolved.append(f'{INCOMPLETE_BRANCHES_REASON}. Missing: {", ".join(missing)}')
        return {}, contributing, unresolved
    unresolved = list(STATIC_UNRESOLVED)

    by_label: dict[str, dict[str, dict[str, Any]]] = {}
    for label, trading_title, is_metal in ABSTRACT_ACCOUNT_ROWS:
        by_label[label] = _consolidate_from_totals(
            [
                _account_totals(snapshots[name], trading_title, is_metal)
                for name in contributing
            ],
            metal=is_metal,
            metal_account=_METAL_BY_TITLE.get(trading_title),
        )

    for label, reason in UNMAPPED_ACCOUNT_REASONS.items():
        by_label[label] = empty_consolidated_measures()
        unresolved.append(reason)

    account_rows = [by_label[label] for label in _ACCOUNT_SECTION_LABELS]
    by_label['TOTAL'] = _sum_consolidated_measures(account_rows)

    diamond_rows: list[dict[str, dict[str, Any]]] = []
    for label in _DIAMOND_ITEM_LABELS:
        aliases = _DIAMOND_SUBCATEGORY_ALIASES[label]
        measures = _consolidate_from_totals(
            [
                _subcategory_totals(snapshots[name].get('layoutByCategory') or {}, 'Diamond', aliases)
                for name in contributing
            ],
            metal=False,
        )
        by_label[label] = measures
        diamond_rows.append(measures)
        if label == 'Diamonds - Black diamonds' and _all_empty(measures):
            missing = [
                name
                for name in contributing
                if not _subcategory_totals(
                    snapshots[name].get('layoutByCategory') or {}, 'Diamond', aliases
                )
            ]
            if len(missing) == len(contributing):
                unresolved.append(
                    'Diamonds - Black diamonds: no matching subcategory_total on sent branch layouts '
                    '(Jubilee Hills uses Diamonds - Black Diamonds; Basheerbagh/Kokapet Rule Book has no Black diamonds group)'
                )
    by_label['Diamonds total'] = _sum_consolidated_measures(diamond_rows)

    color_rows: list[dict[str, dict[str, Any]]] = []
    for product in COLOR_STONE_PRODUCT_ROWS:
        measures = _consolidate_from_totals(
            [
                _subcategory_totals(
                    snapshots[name].get('layoutByCategory') or {},
                    'Precious and Semi Precious',
                    (product,),
                )
                for name in contributing
            ],
            metal=False,
        )
        by_label[product] = measures
        color_rows.append(measures)
    by_label['TOTAL Colour Stones'] = _sum_consolidated_measures(color_rows)

    _flag_jadau_products(snapshots, contributing, unresolved)
    return by_label, contributing, unresolved


def _normalize_branches(
    branches: Mapping[str, Mapping[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    aliases = {
        'basheerbagh': 'basheerbagh',
        'kokapet': 'kokapet',
        'jubileehills': 'jubileeHills',
        'jubilee-hills': 'jubileeHills',
        'jubilee_hills': 'jubileeHills',
        'jubileeHills': 'jubileeHills',
    }
    out: dict[str, dict[str, Any]] = {}
    for raw_name, payload in (branches or {}).items():
        key = aliases.get(str(raw_name).strip()) or aliases.get(str(raw_name).strip().lower())
        if key is None or not isinstance(payload, Mapping):
            continue
        if not _branch_has_sources(payload):
            continue
        out[key] = {
            'layoutByCategory': payload.get('layoutByCategory') or {},
            'salesPivot': payload.get('salesPivot') or [],
            'purchasesPivot': payload.get('purchasesPivot') or [],
            'openingPivot': payload.get('openingPivot') or [],
            'mrPivots': payload.get('mrPivots') or {},
            'dcPivots': payload.get('dcPivots') or {},
        }
    return out


def _branch_has_sources(payload: Mapping[str, Any]) -> bool:
    if payload.get('layoutByCategory'):
        return True
    for key in ('salesPivot', 'purchasesPivot', 'openingPivot'):
        if payload.get(key):
            return True
    return False


def _account_totals(
    snapshot: Mapping[str, Any],
    trading_title: str,
    is_metal: bool,
) -> dict[str, Any]:
    if is_metal:
        metal_totals = aggregate_metal_trading_totals(
            sales_pivot=snapshot.get('salesPivot'),
            purchases_pivot=snapshot.get('purchasesPivot'),
            opening_pivot=snapshot.get('openingPivot'),
            mr_pivots=snapshot.get('mrPivots'),
            dc_pivots=snapshot.get('dcPivots'),
        )
        return dict(metal_totals.get(trading_title) or {})
    category = TRADING_ACCOUNT_SOURCE_CATEGORY[trading_title]
    layouts = snapshot.get('layoutByCategory') or {}
    return _grand_total_from_layout(layouts.get(category))


def _subcategory_totals(
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]],
    category: str,
    aliases: Sequence[str],
) -> dict[str, Any]:
    wanted = {_norm_label(name) for name in aliases}
    for row in layout_by_category.get(category) or ():
        if str(row.get('kind') or '') != 'subcategory_total':
            continue
        names = (row.get('subcategory'), row.get('label'))
        if any(_norm_label(name) in wanted for name in names if name):
            return dict(row)
    return {}


def _norm_label(value: Any) -> str:
    return ' '.join(str(value or '').strip().lower().replace('_', ' ').split())


def _consolidate_from_totals(
    totals_list: Sequence[Mapping[str, Any]],
    *,
    metal: bool,
    metal_account: Mapping[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    present = [dict(totals or {}) for totals in totals_list if totals]
    if not present:
        return empty_consolidated_measures()

    summed_trading = empty_abstract_measures()
    for totals in present:
        measures = abstract_measures_from_trading_source(
            totals,
            metal=metal,
            metal_account=metal_account,
        )
        summed_trading = _add_abstract_maps(summed_trading, measures)

    receipts_qty = _sum_keys_across(present, _RECEIPT_QTY_KEYS)
    receipts_amt = _sum_keys_across(present, _RECEIPT_AMT_KEYS)
    issues_qty = _sum_keys_across(present, _ISSUE_QTY_KEYS)
    issues_amt = _sum_keys_across(present, _ISSUE_AMT_KEYS)
    transfer_qty, consumption_qty = _eliminate(receipts_qty, issues_qty)
    transfer_amt, consumption_amt = _eliminate(receipts_amt, issues_amt)

    opening = summed_trading['Opening Stock']
    purchases = summed_trading['Purchases']
    sales = summed_trading['Sales']
    closing = summed_trading['Closing Stock']
    making = summed_trading['Making Charges']

    if metal:
        right_amt = _sum_present(sales.get('amt'), closing.get('amt'), consumption_amt)
        gp_amt = metal_gross_profit_amt(
            {
                'openingAmt': opening.get('amt'),
                'netPurchasesAmt': purchases.get('amt'),
                'makingChargesAmt': making.get('amt'),
            },
            right_amt,
        )
    else:
        gp_amt = _gem_gross_profit_amt(
            opening_amt=opening.get('amt'),
            purchases_amt=purchases.get('amt'),
            receipts_amt=transfer_amt,
            sales_amt=sales.get('amt'),
            closing_amt=closing.get('amt'),
            issues_amt=consumption_amt,
        )

    out = empty_consolidated_measures()
    out['Opening Stock'] = opening
    out['Purchases - Total'] = purchases
    out['Internal Transfer - Total'] = {'qty': transfer_qty, 'amt': transfer_amt}
    out['Internal Consumption - Total'] = {'qty': consumption_qty, 'amt': consumption_amt}
    out['Making Charges'] = {'qty': None, 'amt': making.get('amt')}
    out['Sales - Total'] = sales
    out['Closing Stock - Total'] = closing
    out['Gross Profit'] = {'qty': None, 'amt': gp_amt}
    out['CY G P %'] = {'qty': None, 'amt': _cy_gp_pct(gp_amt, sales.get('amt'))}
    out['GP AY 2025-26'] = {'qty': None, 'amt': None}
    out['Deviation'] = {'qty': None, 'amt': None}
    return out


def _add_abstract_maps(
    left: Mapping[str, Mapping[str, Any]],
    right: Mapping[str, Mapping[str, Any]],
) -> dict[str, dict[str, Any]]:
    out = empty_abstract_measures()
    for group in out:
        if group == 'CY GP %':
            continue
        out[group] = {
            'qty': _add_num((left.get(group) or {}).get('qty'), (right.get(group) or {}).get('qty')),
            'amt': _add_num((left.get(group) or {}).get('amt'), (right.get(group) or {}).get('amt')),
        }
    out['CY GP %'] = {
        'qty': None,
        'amt': _cy_gp_pct(out['Gross Profit'].get('amt'), out['Sales'].get('amt')),
    }
    return out


def _sum_consolidated_measures(
    rows: Sequence[Mapping[str, Mapping[str, Any]]],
) -> dict[str, dict[str, Any]]:
    summed = empty_consolidated_measures()
    skip = {'CY G P %', 'GP AY 2025-26', 'Deviation'}
    for key in CONSOLIDATED_MEASURE_KEYS:
        if key in skip:
            continue
        qty = None
        amt = None
        for row in rows:
            pair = row.get(key) or {}
            qty = _add_num(qty, pair.get('qty'))
            amt = _add_num(amt, pair.get('amt'))
        summed[key] = {'qty': qty, 'amt': amt}
    gp_amt = (summed.get('Gross Profit') or {}).get('amt')
    sales_amt = (summed.get('Sales - Total') or {}).get('amt')
    summed['CY G P %'] = {'qty': None, 'amt': _cy_gp_pct(gp_amt, sales_amt)}
    return summed


def _gem_gross_profit_amt(
    *,
    opening_amt: Any,
    purchases_amt: Any,
    receipts_amt: Any,
    sales_amt: Any,
    closing_amt: Any,
    issues_amt: Any,
) -> float | None:
    """Closing + Sales + Issues − (Opening + Purchases + Receipts). Same as Closing Stock GP."""
    parts = (opening_amt, purchases_amt, receipts_amt, sales_amt, closing_amt, issues_amt)
    if all(part is None for part in parts):
        return None
    total_amt = (
        Decimal(str(opening_amt or 0))
        + Decimal(str(purchases_amt or 0))
        + Decimal(str(receipts_amt or 0))
    )
    return float(
        Decimal(str(closing_amt or 0))
        + Decimal(str(sales_amt or 0))
        + Decimal(str(issues_amt or 0))
        - total_amt
    )


def _eliminate(left: float | None, right: float | None) -> tuple[float | None, float | None]:
    if left is None and right is None:
        return None, None
    a = float(left or 0)
    b = float(right or 0)
    overlap = min(a, b)
    return a - overlap, b - overlap


def _sum_keys_across(rows: Sequence[Mapping[str, Any]], keys: Sequence[str]) -> float | None:
    total = None
    for row in rows:
        for key in keys:
            total = _add_num(total, row.get(key))
    return total


def _add_num(current: Any, incoming: Any) -> float | None:
    if incoming is None or incoming == '':
        return current
    try:
        number = float(incoming)
    except (TypeError, ValueError):
        return current
    if number != number:
        return current
    if current is None:
        return number
    return float(Decimal(str(current)) + Decimal(str(number)))


def _sum_present(*parts: Any) -> float | None:
    if all(part is None for part in parts):
        return None
    return float(sum(Decimal(str(part or 0)) for part in parts))


def _all_empty(measures: Mapping[str, Mapping[str, Any]]) -> bool:
    for pair in measures.values():
        if pair.get('qty') is not None or pair.get('amt') is not None:
            return False
    return True


def _flag_jadau_products(
    snapshots: Mapping[str, Mapping[str, Any]],
    contributing: Sequence[str],
    unresolved: list[str],
) -> None:
    found = False
    for name in contributing:
        snap = snapshots[name]
        for rows in (
            snap.get('salesPivot'),
            snap.get('purchasesPivot'),
            snap.get('openingPivot'),
        ):
            for row in rows or ():
                product = str(row.get('product') or '')
                if 'jadau' in _norm_label(product) and resolve_metal_trading_account(product) is None:
                    found = True
                    break
            if found:
                break
        if found:
            break
    if found:
        unresolved.append(
            'Gold Ornaments Jadau products were present in branch pivots but were not mapped onto Gold Account Jadau'
        )

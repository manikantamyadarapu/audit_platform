"""Abstract measures taken from the same sources/helpers as the Trading sheet."""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.engines.financials_engine.engine.metal_trading import (
    aggregate_metal_trading_totals,
    metal_gross_profit_amt,
)
from app.engines.financials_engine.engine.trading_template import (
    TRADING_ACCOUNT_SOURCE_CATEGORY,
    TRADING_METAL_ACCOUNTS,
    _account_computed,
    _grand_total_from_layout,
    _head_office_transfer,
    _line_values,
    _metal_side_total,
)

ABSTRACT_ACCOUNT_ROWS: tuple[tuple[str, str, bool], ...] = (
    ('Gold Account 24K', 'GOLD ACCOUNT - 24K', True),
    ('Gold Account 22K', 'GOLD ORNAMENTS ACCOUNT - 22K', True),
    ('Gold Account 18K', 'GOLD ORNAMENTS ACCOUNT - 18K', True),
    ('Gold Account 14K', 'GOLD ORNAMENTS ACCOUNT - 14K', True),
    ('Silver Account', 'SILVER ACCOUNT', True),
    ('Diamonds Account', 'DIAMONDS ACCOUNT', False),
    ('Emeralds', 'EMERALDS ACCOUNT', False),
    ('Pearls', 'PEARLS ACCOUNT', False),
    ('Rubies', 'RUBIES ACCOUNT', False),
    ('Color Stones Account', 'COLOR STONES ACCOUNT', False),
)

DIAMOND_PRODUCT_ROWS: tuple[str, ...] = (
    'Diamonds - Beads',
    'Diamonds Rosecut diamonds',
    'Diamonds - Flat polki',
    'Uncut - diamonds',
    'Diamonds',
)
COLOR_STONE_PRODUCT_ROWS: tuple[str, ...] = (
    'Precious Stones',
    'Semi Precious',
    'Synthetic Stones',
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

_METAL_BY_TITLE = {str(account['title']): account for account in TRADING_METAL_ACCOUNTS}

_ABSTRACT_GROUPS: tuple[str, ...] = (
    'Opening Stock',
    'Purchases',
    'Receipts - Jubilee Hills',
    'Transfer (Receipts)',
    'Issues - Internal Stock Transfer',
    'Issues - Jubilee Hills',
    'Consumption (Issues)',
    'Making Charges',
    'Sales',
    'Closing Stock',
    'Gross Profit',
    'CY GP %',
)


def empty_abstract_measures() -> dict[str, dict[str, Any]]:
    return {group: {'qty': None, 'amt': None} for group in _ABSTRACT_GROUPS}


def abstract_measures_from_trading_source(
    totals: Mapping[str, Any] | None,
    *,
    metal: bool = False,
    metal_account: Mapping[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    """Qty/Amt per Abstract column, using Trading line helpers plus the same source fields."""
    source = dict(totals or {})
    transfer = _head_office_transfer(source)
    if metal:
        account = metal_account or {}
        right_body = [str(label) for label in (account.get('right') or ()) if str(label) != 'Total']
        right_total_qty, right_total_amt = _metal_side_total(
            right_body, source, transfer, 'right'
        )
        computed = {
            'grossProfitAmt': metal_gross_profit_amt(source, right_total_amt),
            'rightQty': right_total_qty,
            'rightAmt': right_total_amt,
        }
    else:
        computed = _account_computed(source, transfer)

    opening = _trading_line('To Opening Stock', source, transfer, computed, metal, 'left')
    purchases = _trading_line('To Purchases', source, transfer, computed, metal, 'left')
    sales = _trading_line('By Sales', source, transfer, computed, metal, 'right')
    closing = _trading_line('By Closing stock', source, transfer, computed, metal, 'right')
    gp = _trading_line('To Gross Profit', source, transfer, computed, metal, 'left')
    making = (source.get('makingChargesQty'), source.get('makingChargesAmt'))
    consumption_qty, consumption_amt = _consumption_issues(source)
    gp_pct = _cy_gp_pct(gp[1], sales[1])

    pairs = {
        'Opening Stock': opening,
        'Purchases': purchases,
        'Receipts - Jubilee Hills': (
            source.get('receiptsJubileeHillsQty'),
            source.get('receiptsJubileeHillsAmt'),
        ),
        'Transfer (Receipts)': (
            source.get('receiptsInternalQty'),
            source.get('receiptsInternalAmt'),
        ),
        'Issues - Internal Stock Transfer': (
            source.get('issuesInternalQty'),
            source.get('issuesInternalAmt'),
        ),
        'Issues - Jubilee Hills': (
            source.get('issuesBanjaraHillsQty'),
            source.get('issuesBanjaraHillsAmt'),
        ),
        'Consumption (Issues)': (consumption_qty, consumption_amt),
        'Making Charges': making,
        'Sales': sales,
        'Closing Stock': closing,
        'Gross Profit': gp,
        'CY GP %': (None, gp_pct),
    }
    return {group: {'qty': pairs[group][0], 'amt': pairs[group][1]} for group in _ABSTRACT_GROUPS}


def _trading_line(
    label: str,
    totals: Mapping[str, Any],
    transfer: Mapping[str, Any] | None,
    computed: Mapping[str, Any] | None,
    metal: bool,
    side: str,
) -> tuple[Any, Any]:
    return _line_values(
        label,
        totals,
        transfer,
        computed,
        side=side,
        metal_source=metal,
    )


def _consumption_issues(totals: Mapping[str, Any]) -> tuple[Any, Any]:
    if totals.get('issuesTotalQty') is not None or totals.get('issuesTotalAmt') is not None:
        return totals.get('issuesTotalQty'), totals.get('issuesTotalAmt')
    return _sum_keys(totals, _ISSUE_QTY_KEYS), _sum_keys(totals, _ISSUE_AMT_KEYS)


def _sum_keys(totals: Mapping[str, Any], keys: Sequence[str]) -> float | None:
    total = None
    for key in keys:
        value = totals.get(key)
        if value is None:
            continue
        total = (0.0 if total is None else total) + float(value)
    return total


def _cy_gp_pct(gp_amt: Any, sales_amt: Any) -> float | None:
    if gp_amt is None or sales_amt is None:
        return None
    sales = float(sales_amt)
    if sales == 0:
        return 0.0
    return float(gp_amt) / sales * 100.0


def sum_abstract_measures(
    rows: Sequence[Mapping[str, Mapping[str, Any]]],
) -> dict[str, dict[str, Any]]:
    summed = empty_abstract_measures()
    for group in _ABSTRACT_GROUPS:
        if group == 'CY GP %':
            continue
        qty = None
        amt = None
        for row in rows:
            pair = row.get(group) or {}
            if pair.get('qty') is not None:
                qty = (0.0 if qty is None else qty) + float(pair['qty'])
            if pair.get('amt') is not None:
                amt = (0.0 if amt is None else amt) + float(pair['amt'])
        summed[group] = {'qty': qty, 'amt': amt}
    gp_amt = (summed.get('Gross Profit') or {}).get('amt')
    sales_amt = (summed.get('Sales') or {}).get('amt')
    summed['CY GP %'] = {'qty': None, 'amt': _cy_gp_pct(gp_amt, sales_amt)}
    return summed


def _subcategory_total(
    layout_rows: Sequence[Mapping[str, Any]] | None,
    subcategory: str,
) -> dict[str, Any]:
    for row in layout_rows or ():
        if str(row.get('kind') or '') != 'subcategory_total':
            continue
        if str(row.get('subcategory') or '').strip() == subcategory:
            return dict(row)
    return {}


def build_abstract_row_measures(
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    opening_pivot: Sequence[Mapping[str, Any]] | None = None,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
) -> dict[str, dict[str, dict[str, Any]]]:
    """Particulars label → Abstract column measures. Group headings stay empty."""
    layouts = layout_by_category or {}
    metal_totals = aggregate_metal_trading_totals(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_pivot,
        mr_pivots=mr_pivots,
        dc_pivots=dc_pivots,
    )
    by_label: dict[str, dict[str, dict[str, Any]]] = {}
    section1: list[dict[str, dict[str, Any]]] = []
    for label, trading_title, is_metal in ABSTRACT_ACCOUNT_ROWS:
        if is_metal:
            measures = abstract_measures_from_trading_source(
                metal_totals.get(trading_title) or {},
                metal=True,
                metal_account=_METAL_BY_TITLE.get(trading_title),
            )
        else:
            category = TRADING_ACCOUNT_SOURCE_CATEGORY[trading_title]
            measures = abstract_measures_from_trading_source(
                _grand_total_from_layout(layouts.get(category)),
                metal=False,
            )
        by_label[label] = measures
        section1.append(measures)
    by_label['TOTAL'] = sum_abstract_measures(section1)

    diamond_layout = layouts.get('Diamond')
    diamond_rows: list[dict[str, dict[str, Any]]] = []
    for product in DIAMOND_PRODUCT_ROWS:
        measures = abstract_measures_from_trading_source(
            _subcategory_total(diamond_layout, product),
            metal=False,
        )
        by_label[product] = measures
        diamond_rows.append(measures)
    by_label['Total Diamonds'] = sum_abstract_measures(diamond_rows)

    color_layout = layouts.get('Precious and Semi Precious')
    color_rows: list[dict[str, dict[str, Any]]] = []
    for product in COLOR_STONE_PRODUCT_ROWS:
        measures = abstract_measures_from_trading_source(
            _subcategory_total(color_layout, product),
            metal=False,
        )
        by_label[product] = measures
        color_rows.append(measures)
    by_label['TOTAL Colour Stones'] = sum_abstract_measures(color_rows)
    return by_label

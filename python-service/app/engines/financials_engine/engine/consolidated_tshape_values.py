"""Company-level Consolidated TShape amounts from the three branch Trading sources."""

from __future__ import annotations

from typing import Any, Mapping

from app.engines.financials_engine.engine.abstract_values import (
    ABSTRACT_ACCOUNT_ROWS,
    abstract_measures_from_trading_source,
)
from app.engines.financials_engine.engine.consolidated_abstract_values import (
    CONSOLIDATED_BRANCH_KEYS,
    INCOMPLETE_BRANCHES_REASON,
    _METAL_BY_TITLE,
    _account_totals,
    _add_num,
    _eliminate,
    _normalize_branches,
)

TSHAPE_BRANCH_COLUMNS: tuple[tuple[str, str], ...] = (
    ('jubileeHills', 'Jubilee Hills - Head Office'),
    ('kokapet', 'Kokapet - Branch'),
    ('basheerbagh', 'Basheerbagh - Branch'),
)

TSHAPE_LEFT_ROWS: tuple[str, ...] = (
    'Opening Stock',
    'Purchases',
    'Stock transfer from Head Office',
    'Making Charges',
    'Alloy Purchases',
    'Gross Profit',
    'Total',
)

TSHAPE_RIGHT_ROWS: tuple[str, ...] = (
    'Sales',
    'Stock Transfer to Branches',
    'Closing Stock',
    'Total',
)

ALLOY_UNRESOLVED = (
    'Alloy Purchases: no Trading Account or Closing Stock source in branch Financials'
)


def empty_tshape_column() -> dict[str, float | None]:
    keys = set(TSHAPE_LEFT_ROWS) | set(TSHAPE_RIGHT_ROWS)
    return {key: None for key in keys}


def build_consolidated_tshape_values(
    branches: Mapping[str, Mapping[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, float | None]], list[str]]:
    """
    Branch-key (and 'total') → row label → amount.

    Branch columns keep that branch's books. The Total column sums additive
    rows and eliminates inter-branch stock transfers.
    """
    snapshots = _normalize_branches(branches)
    by_branch: dict[str, dict[str, float | None]] = {
        key: empty_tshape_column() for key, _label in TSHAPE_BRANCH_COLUMNS
    }
    unresolved = [ALLOY_UNRESOLVED]
    missing = [key for key in CONSOLIDATED_BRANCH_KEYS if key not in snapshots]
    if missing:
        unresolved.append(f'{INCOMPLETE_BRANCHES_REASON}. Missing: {", ".join(missing)}')
        by_branch['total'] = empty_tshape_column()
        return by_branch, unresolved

    for key, _label in TSHAPE_BRANCH_COLUMNS:
        by_branch[key] = _branch_tshape_column(snapshots[key])

    by_branch['total'] = _total_tshape_column(by_branch)
    return by_branch, unresolved


def _branch_tshape_column(snapshot: Mapping[str, Any]) -> dict[str, float | None]:
    opening = purchases = sales = closing = making = gp = from_ho = to_branches = None
    for _label, trading_title, is_metal in ABSTRACT_ACCOUNT_ROWS:
        totals = _account_totals(snapshot, trading_title, is_metal)
        measures = abstract_measures_from_trading_source(
            totals,
            metal=is_metal,
            metal_account=_METAL_BY_TITLE.get(trading_title),
        )
        opening = _add_num(opening, (measures.get('Opening Stock') or {}).get('amt'))
        purchases = _add_num(purchases, (measures.get('Purchases') or {}).get('amt'))
        sales = _add_num(sales, (measures.get('Sales') or {}).get('amt'))
        closing = _add_num(closing, (measures.get('Closing Stock') or {}).get('amt'))
        making = _add_num(making, (measures.get('Making Charges') or {}).get('amt'))
        gp = _add_num(gp, (measures.get('Gross Profit') or {}).get('amt'))
        from_ho = _add_num(from_ho, (measures.get('Receipts - Jubilee Hills') or {}).get('amt'))
        to_branches = _add_num(
            to_branches, (measures.get('Issues - Internal Stock Transfer') or {}).get('amt')
        )
        to_branches = _add_num(
            to_branches, (measures.get('Issues - Jubilee Hills') or {}).get('amt')
        )
        to_branches = _add_num(to_branches, totals.get('issuesKokapetAmt'))

    column = empty_tshape_column()
    column['Opening Stock'] = opening
    column['Purchases'] = purchases
    column['Stock transfer from Head Office'] = from_ho
    column['Making Charges'] = making
    column['Alloy Purchases'] = None
    column['Gross Profit'] = gp
    column['Sales'] = sales
    column['Stock Transfer to Branches'] = to_branches
    column['Closing Stock'] = closing
    column['Total'] = None
    column['Total'] = _side_total(column, TSHAPE_LEFT_ROWS[:-1])
    return column


def _total_tshape_column(
    by_branch: Mapping[str, Mapping[str, float | None]],
) -> dict[str, float | None]:
    def summed(row: str) -> float | None:
        total = None
        for key, _label in TSHAPE_BRANCH_COLUMNS:
            total = _add_num(total, (by_branch.get(key) or {}).get(row))
        return total

    from_ho, to_branches = _eliminate(
        summed('Stock transfer from Head Office'),
        summed('Stock Transfer to Branches'),
    )
    opening = summed('Opening Stock')
    purchases = summed('Purchases')
    making = summed('Making Charges')
    sales = summed('Sales')
    closing = summed('Closing Stock')
    # T-account GP after eliminating inter-branch stock transfers.
    left_without_gp = _add_num(_add_num(_add_num(opening, purchases), from_ho), making)
    right_without_gp = _add_num(_add_num(sales, to_branches), closing)
    gp = None
    if left_without_gp is not None or right_without_gp is not None:
        gp = float((right_without_gp or 0) - (left_without_gp or 0))

    column = empty_tshape_column()
    column['Opening Stock'] = opening
    column['Purchases'] = purchases
    column['Stock transfer from Head Office'] = from_ho
    column['Making Charges'] = making
    column['Alloy Purchases'] = None
    column['Gross Profit'] = gp
    column['Sales'] = sales
    column['Stock Transfer to Branches'] = to_branches
    column['Closing Stock'] = closing
    column['Total'] = _side_total(column, TSHAPE_LEFT_ROWS[:-1])
    return column


def _side_total(column: Mapping[str, float | None], labels: tuple[str, ...]) -> float | None:
    total = None
    for label in labels:
        total = _add_num(total, column.get(label))
    return total

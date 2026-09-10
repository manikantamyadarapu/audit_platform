"""Gold/Silver Trading Account totals from Financials pivots (no extra sheets)."""

from __future__ import annotations

import json
import re
import unicodedata
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping, Sequence

_METAL_RATE_RULE_BOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / 'sales_engine'
    / 'config'
    / 'metal_rate_rule_book.json'
)

_METADATA_KEYS = frozenset({'allowed_variation_percent', 'updated_at'})
_UNICODE_WS = re.compile(
    r'[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+',
    re.UNICODE,
)
_NON_ALNUM = re.compile(r'[^a-z0-9]+', re.IGNORECASE)
_ZERO_EPS = 1e-12
_LOCATION_NET_FIELDS: tuple[tuple[str, str, str], ...] = (
    ('jubileeHills', 'receiptsJubileeHillsQty', 'issuesBanjaraHillsQty'),
    ('kokapet', 'receiptsKokapetQty', 'issuesKokapetQty'),
    ('internalBasheerbagh', 'receiptsInternalQty', 'issuesInternalQty'),
)

GOLD_24K = 'GOLD ACCOUNT - 24K'
GOLD_22K = 'GOLD ORNAMENTS ACCOUNT - 22K'
GOLD_18K = 'GOLD ORNAMENTS ACCOUNT - 18K'
GOLD_14K = 'GOLD ORNAMENTS ACCOUNT - 14K'
SILVER = 'SILVER ACCOUNT'

METAL_TRADING_ACCOUNT_TITLES: tuple[str, ...] = (
    GOLD_24K,
    GOLD_22K,
    GOLD_18K,
    GOLD_14K,
    SILVER,
)


def _empty_bucket() -> dict[str, float | None]:
    return {
        'openingQty': None,
        'openingAmt': None,
        'purchasesQty': None,
        'purchasesAmt': None,
        'salesQty': None,
        'salesAmt': None,
        'purchaseReturnsQty': None,
        'purchaseReturnsAmt': None,
        'salesReturnsQty': None,
        'salesReturnsAmt': None,
        'netPurchasesQty': None,
        'netPurchasesAmt': None,
        'netSalesQty': None,
        'netSalesAmt': None,
        'receiptsInternalQty': None,
        'receiptsJubileeHillsQty': None,
        'receiptsJubileeHillsAmt': None,
        'receiptsKokapetQty': None,
        'issuesInternalQty': None,
        'issuesBanjaraHillsQty': None,
        'issuesBanjaraHillsAmt': None,
        'issuesKokapetQty': None,
        'makingChargesQty': None,
        'makingChargesAmt': None,
        'grossProfitQty': None,
        'averageRateAmt': None,
        'closingStockQty': None,
        'closingStockAmt': None,
    }


def _norm_product(name: str) -> str:
    text = unicodedata.normalize('NFKC', str(name))
    text = _UNICODE_WS.sub(' ', text).strip().casefold()
    return ' '.join(text.split())


def _match_key(name: str) -> str:
    return _NON_ALNUM.sub('', _norm_product(name))


def _core_sku_key(name: str) -> str:
    tokens = _norm_product(name).replace('.', ' ').split()
    cleaned = [_NON_ALNUM.sub('', t) for t in tokens]
    cleaned = [t for t in cleaned if t]
    if not cleaned:
        return ''
    digit_idx = None
    for i in range(len(cleaned) - 1, -1, -1):
        if any(ch.isdigit() for ch in cleaned[i]):
            digit_idx = i
            break
    if digit_idx is None:
        return ''.join(cleaned)
    start = digit_idx
    if start > 0 and cleaned[start - 1].isalpha():
        start -= 1
    return ''.join(cleaned[start:])


def _resolve_display_name(pivot_product: str, *, lookup: Mapping[str, str]) -> str | None:
    for key in (
        _norm_product(pivot_product),
        _match_key(pivot_product),
        _core_sku_key(pivot_product),
    ):
        if key and key in lookup:
            return lookup[key]
    return None


def _account_from_metal_name(name: str) -> str | None:
    key = _match_key(name)
    if not key or 'jadau' in key:
        return None
    if 'silver' in key:
        return SILVER
    if '24k' in key:
        return GOLD_24K
    if '22k' in key:
        return GOLD_22K
    if '18k' in key:
        return GOLD_18K
    if '14k' in key:
        return GOLD_14K
    return None


@lru_cache(maxsize=1)
def _metal_catalog_names() -> tuple[str, ...]:
    try:
        data = json.loads(_METAL_RATE_RULE_BOOK_PATH.read_text(encoding='utf-8'))
    except OSError:
        return ()
    if not isinstance(data, dict):
        return ()
    names: list[str] = []
    for key in data:
        label = str(key).strip()
        if not label or label in _METADATA_KEYS:
            continue
        if _account_from_metal_name(label) is None:
            continue
        names.append(label)
    return tuple(names)


def _build_metal_match_lookup(catalog: Sequence[str]) -> dict[str, str]:
    core_owners: dict[str, list[str]] = {}
    for display_name in catalog:
        core = _core_sku_key(display_name)
        if core:
            core_owners.setdefault(core, []).append(display_name)

    lookup: dict[str, str] = {}
    for display_name in catalog:
        for key in (_norm_product(display_name), _match_key(display_name)):
            if key and key not in lookup:
                lookup[key] = display_name
        core = _core_sku_key(display_name)
        if core and len(core_owners.get(core, [])) == 1 and core not in lookup:
            lookup[core] = display_name
    return lookup


@lru_cache(maxsize=1)
def _metal_lookup() -> dict[str, str]:
    return _build_metal_match_lookup(_metal_catalog_names())


def resolve_metal_catalog_name(product: str) -> str | None:
    """Metal-rate catalog display name, using Financials product matching."""
    name = str(product or '').strip()
    if not name:
        return None
    return _resolve_display_name(name, lookup=_metal_lookup())


def resolve_metal_trading_account(product: str) -> str | None:
    """Map a Financials product label onto one Gold/Silver Trading Account."""
    name = str(product or '').strip()
    if not name:
        return None
    display = resolve_metal_catalog_name(name)
    if display:
        return _account_from_metal_name(display)
    return _account_from_metal_name(name)


def metal_opening_group(product: str) -> dict[str, str | None] | None:
    """
    Opening Stock Manual Mapping group for Gold/Silver products.

    Jadau is grouped for Opening mapping only (no Trading Account).
    """
    name = str(product or '').strip()
    if not name:
        return None
    catalog = resolve_metal_catalog_name(name)
    key = _match_key(catalog or name)
    if 'jadau' in key:
        return {
            'category': 'Gold Ornaments',
            'subcategory': 'Jadau',
            'account': None,
            'catalogName': catalog,
        }
    account = resolve_metal_trading_account(name)
    if account == GOLD_24K:
        return {'category': 'Gold', 'subcategory': '24K', 'account': account, 'catalogName': catalog}
    if account == GOLD_22K:
        return {
            'category': 'Gold Ornaments',
            'subcategory': '22K',
            'account': account,
            'catalogName': catalog,
        }
    if account == GOLD_18K:
        return {
            'category': 'Gold Ornaments',
            'subcategory': '18K',
            'account': account,
            'catalogName': catalog,
        }
    if account == GOLD_14K:
        return {
            'category': 'Gold Ornaments',
            'subcategory': '14K',
            'account': account,
            'catalogName': catalog,
        }
    if account == SILVER:
        return {'category': 'Silver', 'subcategory': None, 'account': account, 'catalogName': catalog}
    return None


def _coerce_measure(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    return number


def _row_qty_amt(row: Mapping[str, Any]) -> tuple[float | None, float | None]:
    qty = _coerce_measure(row.get('sumOfQuantity'))
    if qty is None:
        qty = _coerce_measure(row.get('openingQty'))
    amt = _coerce_measure(row.get('sumOfGross'))
    if amt is None:
        amt = _coerce_measure(row.get('openingAmt'))
    return qty, amt


def _add_measure(current: float | None, incoming: float | None) -> float | None:
    if incoming is None:
        return current
    if current is None:
        return incoming
    return float(Decimal(str(current)) + Decimal(str(incoming)))


def _net_measure(base: float | None, less: float | None) -> float | None:
    if base is None and less is None:
        return None
    return float(Decimal(str(base or 0)) - Decimal(str(less or 0)))


def from_head_office_qty(entry: Mapping[str, float | None]) -> float | None:
    """Qty on 'To Transfer from Head Office' (Receipts Jubilee − Issues Banjara, if > 0)."""
    receipts = _coerce_measure(entry.get('receiptsJubileeHillsQty')) or 0.0
    issues = _coerce_measure(entry.get('issuesBanjaraHillsQty')) or 0.0
    qty = receipts - issues
    if qty <= _ZERO_EPS:
        return None
    return qty


def to_head_office_qty(entry: Mapping[str, float | None]) -> float | None:
    """Qty on 'By Transfer to Head Office' (Issues Banjara − Receipts Jubilee, if > 0)."""
    receipts = _coerce_measure(entry.get('receiptsJubileeHillsQty')) or 0.0
    issues = _coerce_measure(entry.get('issuesBanjaraHillsQty')) or 0.0
    qty = issues - receipts
    if qty <= _ZERO_EPS:
        return None
    return qty


def metal_closing_qty(entry: Mapping[str, float | None]) -> float | None:
    """
    Gold/Silver Trading only:
    Opening + Purchase Difference + From HO + Making Charges + GP Qty
    − (Sales Difference + To HO).
    """
    parts = (
        entry.get('openingQty'),
        entry.get('netPurchasesQty'),
        from_head_office_qty(entry),
        entry.get('makingChargesQty'),
        entry.get('grossProfitQty'),
        entry.get('netSalesQty'),
        to_head_office_qty(entry),
    )
    if all(part is None for part in parts):
        return None
    debit = (
        Decimal(str(entry.get('openingQty') or 0))
        + Decimal(str(entry.get('netPurchasesQty') or 0))
        + Decimal(str(from_head_office_qty(entry) or 0))
        + Decimal(str(entry.get('makingChargesQty') or 0))
        + Decimal(str(entry.get('grossProfitQty') or 0))
    )
    credit = Decimal(str(entry.get('netSalesQty') or 0)) + Decimal(
        str(to_head_office_qty(entry) or 0)
    )
    return float(debit - credit)


def to_head_office_amt(entry: Mapping[str, float | None]) -> float | None:
    """By Transfer to Head Office Amt = Qty × net rate."""
    rate = entry.get('averageRateAmt')
    if rate is None:
        rate = _metal_average_rate(entry)
    return _qty_times_rate(to_head_office_qty(entry), rate)


def metal_closing_amt(entry: Mapping[str, float | None]) -> float | None:
    """Gold/Silver Trading: Closing Qty × net average rate."""
    rate = entry.get('averageRateAmt')
    if rate is None:
        rate = _metal_average_rate(entry)
    return _qty_times_rate(metal_closing_qty(entry), rate)


def metal_gross_profit_amt(
    entry: Mapping[str, float | None],
    right_amt: float | None = None,
) -> float | None:
    """Right Total Amt − (Opening + Purchase Difference + From HO + Making) Amt."""
    if right_amt is None:
        right_amt = _sum_present(entry.get('netSalesAmt'), metal_closing_amt(entry))
    debit_amt = _sum_present(
        entry.get('openingAmt'),
        entry.get('netPurchasesAmt'),
        entry.get('makingChargesAmt'),
    )
    if right_amt is None and debit_amt is None:
        return None
    return float(Decimal(str(right_amt or 0)) - Decimal(str(debit_amt or 0)))


def _accumulate_source(
    buckets: dict[str, dict[str, float | None]],
    rows: Sequence[Mapping[str, Any]] | None,
    qty_key: str,
    amt_key: str,
) -> None:
    for row in rows or ():
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        account = resolve_metal_trading_account(product)
        if account is None:
            continue
        qty, amt = _row_qty_amt(row)
        if qty is None and amt is None:
            continue
        entry = buckets[account]
        entry[qty_key] = _add_measure(entry[qty_key], qty)
        entry[amt_key] = _add_measure(entry[amt_key], amt)


def _qty_by_metal_account(rows: Sequence[Mapping[str, Any]] | None) -> dict[str, float]:
    totals: dict[str, float] = {}
    for row in rows or ():
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        account = resolve_metal_trading_account(product)
        if account is None:
            continue
        qty = _coerce_measure(row.get('sumOfQuantity'))
        if qty is None:
            continue
        totals[account] = float(Decimal(str(totals.get(account, 0.0))) + Decimal(str(qty)))
    return totals


def _apply_mr_dc_nets(
    buckets: dict[str, dict[str, float | None]],
    *,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None,
) -> None:
    """Same branch net as product sheets: MR Qty − DC Qty; sign picks Receipts vs Issues."""
    mr_tree = mr_pivots or {}
    dc_tree = dc_pivots or {}
    for location, receipts_key, issues_key in _LOCATION_NET_FIELDS:
        mr_qty = _qty_by_metal_account(mr_tree.get(location))
        dc_qty = _qty_by_metal_account(dc_tree.get(location))
        for account in set(mr_qty) | set(dc_qty):
            net = float(Decimal(str(mr_qty.get(account, 0.0))) - Decimal(str(dc_qty.get(account, 0.0))))
            if abs(net) < _ZERO_EPS:
                continue
            entry = buckets[account]
            if net > 0:
                entry[receipts_key] = _add_measure(entry[receipts_key], float(net))
            else:
                entry[issues_key] = _add_measure(entry[issues_key], float(abs(net)))


def _metal_average_rate(entry: Mapping[str, float | None]) -> float | None:
    """
    (Opening + Purchase Difference + From HO + Making Charges) Amt
    / same Qty.
    """
    qty = _sum_present(
        entry.get('openingQty'),
        entry.get('netPurchasesQty'),
        from_head_office_qty(entry),
        entry.get('makingChargesQty'),
    )
    amt = _sum_present(
        entry.get('openingAmt'),
        entry.get('netPurchasesAmt'),
        entry.get('makingChargesAmt'),
    )
    if qty is None and amt is None:
        return None
    if qty is None or qty == 0:
        return 0.0
    return float(
        (Decimal(str(amt or 0)) / Decimal(str(qty))).quantize(
            Decimal('0.0001'),
            rounding=ROUND_HALF_UP,
        )
    )


def _sum_present(*parts: float | None) -> float | None:
    if all(part is None for part in parts):
        return None
    return float(sum(Decimal(str(part or 0)) for part in parts))


def _qty_times_rate(qty: float | None, rate: float | None) -> float | None:
    if qty is None:
        return None
    if qty == 0:
        return 0.0
    return float(Decimal(str(qty)) * Decimal(str(rate or 0)))


def _apply_head_office_issue_amounts(entry: dict[str, float | None]) -> None:
    """Net rate; To HO Amt = Qty × rate. From HO Amt is never calculated."""
    rate = _metal_average_rate(entry)
    entry['averageRateAmt'] = rate
    entry['receiptsJubileeHillsAmt'] = None
    entry['issuesBanjaraHillsAmt'] = to_head_office_amt(entry)


def aggregate_metal_trading_totals(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    opening_pivot: Sequence[Mapping[str, Any]] | None = None,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
) -> dict[str, dict[str, float | None]]:
    """
    SUM Opening / Purchases / Sales by metal Trading Account.

    Head Office uses the product-sheet rule: Jubilee Hills MR − Banjara Hills DC.
    Closing Amt = Closing Qty × net rate.
    Net rate = (Opening + Purchase Difference + From HO + Making Charges) Amt
    / same Qty.
    """
    buckets = {title: _empty_bucket() for title in METAL_TRADING_ACCOUNT_TITLES}
    _accumulate_source(buckets, opening_pivot, 'openingQty', 'openingAmt')
    _accumulate_source(buckets, purchases_pivot, 'purchasesQty', 'purchasesAmt')
    _accumulate_source(buckets, sales_pivot, 'salesQty', 'salesAmt')
    _apply_mr_dc_nets(buckets, mr_pivots=mr_pivots, dc_pivots=dc_pivots)
    for entry in buckets.values():
        entry['netPurchasesQty'] = _net_measure(
            entry['purchasesQty'], entry['purchaseReturnsQty']
        )
        entry['netPurchasesAmt'] = _net_measure(
            entry['purchasesAmt'], entry['purchaseReturnsAmt']
        )
        entry['netSalesQty'] = _net_measure(entry['salesQty'], entry['salesReturnsQty'])
        entry['netSalesAmt'] = _net_measure(entry['salesAmt'], entry['salesReturnsAmt'])
        _apply_head_office_issue_amounts(entry)
        entry['closingStockQty'] = metal_closing_qty(entry)
        entry['closingStockAmt'] = metal_closing_amt(entry)
    return buckets

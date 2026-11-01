"""Reconcile sending-branch Issues with receiving-branch Receipts.

Source Issue Quantity is authoritative for the destination Receipt Quantity.
The destination is the Issue location (named branch or Internal), not the
Party name. Party and voucher details are kept on the review list only.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.engines.financials_engine.engine.mr_dc_pivots import classify_mr_dc_location
from app.engines.financials_engine.engine.opening_stock import (
    alnum_opening_product_key,
    norm_opening_product_name,
    product_identity_key,
)
from app.engines.financials_engine.config.product_rule_book import _coerce_measure

_QTY_EPS = 1e-4

# Source DC location and destination MR location for reconciliation only.
# Named locations match themselves. Internal is not used as a counterpart branch.
TRANSFER_DIRECTION_LOCATIONS: dict[tuple[str, str], tuple[str, str]] = {
    ('basheerbagh', 'jubileeHills'): ('jubileeHills', 'jubileeHills'),
    ('basheerbagh', 'kokapet'): ('kokapet', 'kokapet'),
    ('basheerbagh', 'basheerbagh'): ('internalBasheerbagh', 'internalBasheerbagh'),
    ('jubileeHills', 'basheerbagh'): ('jubileeHills', 'jubileeHills'),
    ('jubileeHills', 'kokapet'): ('jubileeHills', 'jubileeHills'),
    ('jubileeHills', 'jubileeHills'): ('internalBasheerbagh', 'internalBasheerbagh'),
    ('kokapet', 'jubileeHills'): ('kokapet', 'kokapet'),
    ('kokapet', 'kokapet'): ('internalBasheerbagh', 'internalBasheerbagh'),
}


def normalize_party(value: Any) -> str:
    return ' '.join(str(value or '').replace('\n', ' ').replace('\r', ' ').lower().split())


def product_keys(name: str) -> list[str]:
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


def primary_product_key(name: str) -> str:
    keys = product_keys(name)
    return keys[0] if keys else str(name or '').strip().casefold()


def aggregate_transfer_lines(
    rows: Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Sum quantity by location + party + product identity. First display names win."""
    buckets: dict[tuple[str, str, str], dict[str, Any]] = {}
    order: list[tuple[str, str, str]] = []
    for row in rows or ():
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        location = str(row.get('location') or '').strip() or classify_mr_dc_location(
            row.get('branch'), row.get('party')
        )
        if not location:
            continue
        qty = _coerce_measure(row.get('quantity') if 'quantity' in row else row.get('sumOfQuantity'))
        if qty is None:
            continue
        party_key = normalize_party(row.get('party') or row.get('partyKey'))
        prod_key = primary_product_key(product)
        bucket_key = (location, party_key, prod_key)
        current = buckets.get(bucket_key)
        if current is None:
            buckets[bucket_key] = {
                'location': location,
                'party': str(row.get('party') or '').strip(),
                'partyKey': party_key,
                'product': product,
                'quantity': float(qty),
                'voucherNo': str(row.get('voucherNo') or row.get('voucher_no') or '').strip(),
                'date': str(row.get('date') or '').strip(),
            }
            order.append(bucket_key)
            continue
        current['quantity'] = float(current['quantity']) + float(qty)
    return [buckets[key] for key in order]


def build_transfer_lines_from_rows(
    rows: Sequence[Mapping[str, Any]] | None,
) -> list[dict[str, Any]]:
    classified: list[dict[str, Any]] = []
    for row in rows or ():
        loc = classify_mr_dc_location(row.get('branch'), row.get('party'))
        if loc is None:
            continue
        classified.append({**dict(row), 'location': loc})
    return aggregate_transfer_lines(classified)


def _index_lines(
    lines: Sequence[Mapping[str, Any]] | None,
    *,
    location: str,
) -> dict[tuple[str, str], list[dict[str, Any]]]:
    index: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for line in lines or ():
        if str(line.get('location') or '') != location:
            continue
        party_key = str(line.get('partyKey') or normalize_party(line.get('party')))
        for key in product_keys(str(line.get('product') or '')):
            index.setdefault((party_key, key), []).append(dict(line))
    return index


def _unique_line(candidates: Sequence[Mapping[str, Any]]) -> dict[str, Any] | str:
    if not candidates:
        return 'missing'
    products = {str(row.get('product') or '') for row in candidates}
    parties = {str(row.get('partyKey') or '') for row in candidates}
    if len(products) > 1 or len(parties) > 1:
        return 'ambiguous'
    qty = sum(float(row.get('quantity') or 0) for row in candidates)
    first = dict(candidates[0])
    first['quantity'] = qty
    return first


def reconcile_direction(
    *,
    source_branch: str,
    destination_branch: str,
    source_issue_qty: float | None,
    destination_mr_qty: float | None,
    product: str,
    source_dc_lines: Sequence[Mapping[str, Any]] | None = None,
    destination_mr_lines: Sequence[Mapping[str, Any]] | None = None,
    receipt_qty_field: str = '',
) -> list[dict[str, Any]]:
    """Compare source Issue qty with destination MR qty. Party names are informational."""
    review: list[dict[str, Any]] = []
    locations = TRANSFER_DIRECTION_LOCATIONS.get((source_branch, destination_branch))
    source_qty = _coerce_measure(source_issue_qty)
    dest_qty = _coerce_measure(destination_mr_qty)

    if not locations:
        return review

    src_loc, dest_loc = locations
    party_names = sorted(
        {
            str(line.get('party') or '').strip()
            for line in list(source_dc_lines or []) + list(destination_mr_lines or [])
            if str(line.get('party') or '').strip()
            and str(line.get('location') or '') in {src_loc, dest_loc}
        }
    )

    status = 'matched'
    difference = None
    if source_qty is None:
        return review
    if dest_qty is None:
        status = 'unmatchedReceiver'
    else:
        difference = float(source_qty) - float(dest_qty)
        if abs(difference) <= _QTY_EPS:
            difference = 0.0
        else:
            status = 'quantityMismatch'
    review.append(
        {
            'status': status,
            'sourceBranch': source_branch,
            'destinationBranch': destination_branch,
            'product': product,
            'party': ', '.join(party_names),
            'sourceIssueQty': source_qty,
            'destinationMrQty': dest_qty,
            'authoritativeReceiptQty': source_qty,
            'difference': difference,
            'receiptQtyField': receipt_qty_field,
            'sourceVoucherNo': '',
            'destinationVoucherNo': '',
        }
    )
    return review

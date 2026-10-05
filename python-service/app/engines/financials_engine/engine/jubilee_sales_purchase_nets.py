"""Jubilee Hills net sales and net purchases from six product pivots.

Sales and Purchases pivots stay as built. These nets are a separate calculation.
Opening, MR, and DC are not inputs.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.engines.financials_engine.engine.opening_stock import product_identity_key


def _round_measure(value: float) -> float:
    return round(float(value), 4)


def _digit_core(product: str) -> str:
    """Complete code such as jem100. FP 1 and FP 10 stay different. Names without a number are skipped."""
    from app.engines.financials_engine.config.product_rule_book import _core_sku_key

    core = _core_sku_key(product)
    if core and any(character.isdigit() for character in core):
        return core
    return ''


def _index_pivot(rows: Sequence[Mapping[str, Any]] | None) -> dict[str, dict[str, Any]]:
    """One bucket per normalized product. The first display name is kept."""
    indexed: dict[str, dict[str, Any]] = {}
    for row in rows or ():
        product = str(row.get('product') or '').strip()
        key = product_identity_key(product)
        if not product or not key:
            continue
        bucket = indexed.get(key)
        qty = float(row.get('sumOfQuantity') or 0)
        amt = float(row.get('sumOfGross') or 0)
        if bucket is None:
            indexed[key] = {'product': product, 'qty': qty, 'amt': amt}
            continue
        bucket['qty'] += qty
        bucket['amt'] += amt
    return indexed


def _pivot_row(product: str, qty: float, amt: float) -> dict[str, Any]:
    return {
        'product': product,
        'sumOfQuantity': _round_measure(qty),
        'sumOfGross': _round_measure(amt),
    }


def build_jubilee_sales_purchase_nets(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    sales_return_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchase_return_pivot: Sequence[Mapping[str, Any]] | None = None,
    debit_note_pivot: Sequence[Mapping[str, Any]] | None = None,
    credit_note_pivot: Sequence[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Match the six pivots by product identity and calculate net sales and purchases.

    Net Sales Qty = Sales Qty − Sales Return Qty
    Net Sales Amount = Sales Amount − Sales Return Amount
    Net Purchase Qty = Purchase Qty − Purchase Return Qty
    Net Purchase Amount = Purchase Amount + Debit Amount − Credit Amount − Purchase Return Amount

    A product that appears in any of the six pivots is kept. Loose variants share one row.
    The same complete code shares one row: Emeralds JEM 100 and JEM 100. FP 1 stays apart from FP 10.
    """
    sources = (
        ('sales', _index_pivot(sales_pivot)),
        ('purchases', _index_pivot(purchases_pivot)),
        ('salesReturn', _index_pivot(sales_return_pivot)),
        ('purchaseReturn', _index_pivot(purchase_return_pivot)),
        ('debitNote', _index_pivot(debit_note_pivot)),
        ('creditNote', _index_pivot(credit_note_pivot)),
    )
    order: list[str] = []
    seen: set[str] = set()
    for _name, index in sources:
        for key in index:
            if key not in seen:
                seen.add(key)
                order.append(key)

    parent = {key: key for key in order}
    first_seen = {key: index for index, key in enumerate(order)}

    def find(key: str) -> str:
        while parent[key] != key:
            parent[key] = parent[parent[key]]
            key = parent[key]
        return key

    def union(left: str, right: str) -> None:
        root_left, root_right = find(left), find(right)
        if root_left == root_right:
            return
        if first_seen[root_left] <= first_seen[root_right]:
            parent[root_right] = root_left
        else:
            parent[root_left] = root_right

    core_owner: dict[str, str] = {}
    for key in order:
        product = next(index[key]['product'] for _name, index in sources if key in index)
        core = _digit_core(product)
        if not core:
            continue
        owner = core_owner.get(core)
        if owner is None:
            core_owner[core] = key
        else:
            union(owner, key)

    clusters: dict[str, list[str]] = {}
    cluster_order: list[str] = []
    for key in order:
        root = find(key)
        if root not in clusters:
            clusters[root] = []
            cluster_order.append(root)
        clusters[root].append(key)

    products: list[dict[str, Any]] = []
    net_sales: list[dict[str, Any]] = []
    net_purchases: list[dict[str, Any]] = []
    for root in cluster_order:
        keys = clusters[root]

        def summed(source: str, field: str) -> tuple[float, bool]:
            index = dict(sources)[source]
            total = 0.0
            found = False
            for key in keys:
                row = index.get(key)
                if row is None:
                    continue
                found = True
                total += float(row[field])
            return total, found

        present_names = [
            name
            for name, index in sources
            if any(key in index for key in keys)
        ]
        display = next(
            index[key]['product']
            for key in keys
            for _name, index in sources
            if key in index
        )

        sales_qty, has_sales_rows = summed('sales', 'qty')
        sales_amt, _sales_amt_found = summed('sales', 'amt')
        sales_return_qty, has_sales_return = summed('salesReturn', 'qty')
        sales_return_amt, _sales_return_amt_found = summed('salesReturn', 'amt')
        purchase_qty, has_purchase_rows = summed('purchases', 'qty')
        purchase_amt, _purchase_amt_found = summed('purchases', 'amt')
        purchase_return_qty, has_purchase_return = summed('purchaseReturn', 'qty')
        purchase_return_amt, _purchase_return_amt_found = summed('purchaseReturn', 'amt')
        debit_amt, has_debit = summed('debitNote', 'amt')
        credit_amt, has_credit = summed('creditNote', 'amt')

        has_sales = has_sales_rows or has_sales_return
        has_purchases = has_purchase_rows or has_purchase_return or has_debit or has_credit
        net_sales_qty = sales_qty - sales_return_qty
        net_sales_amt = sales_amt - sales_return_amt
        net_purchase_qty = purchase_qty - purchase_return_qty
        net_purchase_amt = purchase_amt + debit_amt - credit_amt - purchase_return_amt

        sales_name = display
        for source in ('sales', 'salesReturn'):
            index = dict(sources)[source]
            match = next((index[key]['product'] for key in keys if key in index), None)
            if match:
                sales_name = match
                break
        purchase_name = display
        for source in ('purchases', 'purchaseReturn', 'debitNote', 'creditNote'):
            index = dict(sources)[source]
            match = next((index[key]['product'] for key in keys if key in index), None)
            if match:
                purchase_name = match
                break
        if has_sales:
            net_sales.append(_pivot_row(sales_name, net_sales_qty, net_sales_amt))
        if has_purchases:
            net_purchases.append(_pivot_row(purchase_name, net_purchase_qty, net_purchase_amt))

        products.append(
            {
                'product': display,
                'identityKey': root,
                'identityKeys': list(keys),
                'sources': present_names,
                'salesQty': _round_measure(sales_qty) if has_sales_rows else None,
                'salesAmount': _round_measure(sales_amt) if has_sales_rows else None,
                'salesReturnQty': _round_measure(sales_return_qty) if has_sales_return else None,
                'salesReturnAmount': _round_measure(sales_return_amt) if has_sales_return else None,
                'netSalesQty': _round_measure(net_sales_qty) if has_sales else None,
                'netSalesAmount': _round_measure(net_sales_amt) if has_sales else None,
                'purchaseQty': _round_measure(purchase_qty) if has_purchase_rows else None,
                'purchaseAmount': _round_measure(purchase_amt) if has_purchase_rows else None,
                'purchaseReturnQty': (
                    _round_measure(purchase_return_qty) if has_purchase_return else None
                ),
                'purchaseReturnAmount': (
                    _round_measure(purchase_return_amt) if has_purchase_return else None
                ),
                'debitAmount': _round_measure(debit_amt) if has_debit else None,
                'creditAmount': _round_measure(credit_amt) if has_credit else None,
                'netPurchaseQty': _round_measure(net_purchase_qty) if has_purchases else None,
                'netPurchaseAmount': _round_measure(net_purchase_amt) if has_purchases else None,
                'accounted': True,
            }
        )

    input_keys = {key for _name, index in sources for key in index}
    report_keys = {key for row in products for key in row['identityKeys']}
    unaccounted = sorted(input_keys - report_keys)
    return {
        'netSalesPivot': net_sales,
        'netPurchasesPivot': net_purchases,
        'report': {
            'products': products,
            'unaccountedProducts': unaccounted,
            'inputProductCount': len(input_keys),
            'accountedProductCount': len(report_keys),
        },
    }

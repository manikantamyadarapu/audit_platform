"""MR/DC → Receipts/Issues classification, aggregation, and net-movement helpers."""

from __future__ import annotations

from collections import OrderedDict
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.config.receipts_issues_config import (
    ISSUES_BUCKET_KEYS,
    ISSUES_MEASURE_BY_BUCKET,
    ISSUES_TOTAL_KEYS,
    RECEIPTS_BUCKET_KEYS,
    RECEIPTS_ISSUES_MEASURE_KEYS,
    RECEIPTS_MEASURE_BY_BUCKET,
    RECEIPTS_TOTAL_KEYS,
    build_classification_matcher,
    classify_transfer_text,
    load_receipts_issues_classification,
)
from app.utils.logger import get_logger


def _empty_bucket_totals(bucket_keys: Sequence[str]) -> dict[str, dict[str, float]]:
    return {key: {'qty': 0.0, 'amt': 0.0} for key in bucket_keys}


def classify_and_aggregate_transfers(
    rows: Sequence[Mapping[str, Any]],
    *,
    side: str,
    matcher: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Classify MR (receipts) or DC (issues) rows into template buckets and aggregate.

    Returns:
      - bucketPivot: [{product, bucket, sumOfQuantity, sumOfGross}, ...]  (unrounded)
      - productTotals: {product: {bucket: {qty, amt}}}
      - unclassifiedRows / unclassifiedCount
      - bucketSummary: per-bucket qty/amt
      - classifiedRowCount
    """
    if side not in {'receipts', 'issues'}:
        raise ValueError(f'Unknown transfer side: {side!r}')

    index = matcher if matcher is not None else build_classification_matcher()
    bucket_keys = RECEIPTS_BUCKET_KEYS if side == 'receipts' else ISSUES_BUCKET_KEYS

    # product → bucket → totals (preserve first-seen product spelling)
    by_product: OrderedDict[str, dict[str, dict[str, float]]] = OrderedDict()
    product_display: dict[str, str] = {}
    unclassified: list[dict[str, Any]] = []
    classified_count = 0
    bucket_summary = _empty_bucket_totals(bucket_keys)

    for row in rows:
        product = str(row.get('product') or '').strip()
        if not product:
            continue
        qty = float(row.get('quantity') or 0)
        amt = float(row.get('grossAmount') or 0)
        hint = row.get('classificationHint') or ''
        bucket = classify_transfer_text(hint, side=side, matcher=index)

        if bucket is None:
            unclassified.append(
                {
                    'product': product,
                    'quantity': qty,
                    'grossAmount': amt,
                    'classificationHint': hint,
                }
            )
            continue

        classified_count += 1
        key = product  # group by exact display first-seen; Rule Book rematch happens later
        if key not in by_product:
            by_product[key] = _empty_bucket_totals(bucket_keys)
            product_display[key] = product
        by_product[key][bucket]['qty'] += qty
        by_product[key][bucket]['amt'] += amt
        bucket_summary[bucket]['qty'] += qty
        bucket_summary[bucket]['amt'] += amt

    bucket_pivot: list[dict[str, Any]] = []
    for product_key, buckets in by_product.items():
        display = product_display[product_key]
        for bucket in bucket_keys:
            totals = buckets[bucket]
            if totals['qty'] == 0.0 and totals['amt'] == 0.0:
                continue
            bucket_pivot.append(
                {
                    'product': display,
                    'bucket': bucket,
                    'sumOfQuantity': round(totals['qty'], 4),
                    'sumOfGross': round(totals['amt'], 4),
                }
            )

    include_ist = bool(index.get('includeIstInTotals', True))
    total_qty = 0.0
    total_amt = 0.0
    for bucket, totals in bucket_summary.items():
        if bucket == 'ist' and not include_ist:
            continue
        total_qty += totals['qty']
        total_amt += totals['amt']

    return {
        'side': side,
        'bucketPivot': bucket_pivot,
        'unclassifiedRows': unclassified,
        'unclassifiedCount': len(unclassified),
        'classifiedRowCount': classified_count,
        'bucketSummary': {
            bucket: {
                'qty': round(totals['qty'], 4),
                'amt': round(totals['amt'], 4),
            }
            for bucket, totals in bucket_summary.items()
        },
        'totalQty': round(total_qty, 4),
        'totalAmt': round(total_amt, 4),
        'includeIstInTotals': include_ist,
        'productCount': len(by_product),
    }


def process_mr_dc_ledgers(
    *,
    mr_rows: Sequence[Mapping[str, Any]] | None = None,
    dc_rows: Sequence[Mapping[str, Any]] | None = None,
    log: Any | None = None,
) -> dict[str, Any]:
    """Classify MR → Receipts and DC → Issues; return pivots + reports."""
    logger = log or get_logger()
    config = load_receipts_issues_classification()
    matcher = build_classification_matcher(config)

    receipts = classify_and_aggregate_transfers(
        mr_rows or (),
        side='receipts',
        matcher=matcher,
    )
    issues = classify_and_aggregate_transfers(
        dc_rows or (),
        side='issues',
        matcher=matcher,
    )

    logger.info(
        'MR/DC classify: receipts classified={} unclassified={} | '
        'issues classified={} unclassified={}',
        receipts['classifiedRowCount'],
        receipts['unclassifiedCount'],
        issues['classifiedRowCount'],
        issues['unclassifiedCount'],
    )

    return {
        'receiptsPivot': receipts['bucketPivot'],
        'issuesPivot': issues['bucketPivot'],
        'receiptsReport': {
            'classifiedRowCount': receipts['classifiedRowCount'],
            'unclassifiedCount': receipts['unclassifiedCount'],
            'unclassifiedRows': receipts['unclassifiedRows'][:200],
            'bucketSummary': receipts['bucketSummary'],
            'totalQty': receipts['totalQty'],
            'totalAmt': receipts['totalAmt'],
            'productCount': receipts['productCount'],
            'includeIstInTotals': receipts['includeIstInTotals'],
        },
        'issuesReport': {
            'classifiedRowCount': issues['classifiedRowCount'],
            'unclassifiedCount': issues['unclassifiedCount'],
            'unclassifiedRows': issues['unclassifiedRows'][:200],
            'bucketSummary': issues['bucketSummary'],
            'totalQty': issues['totalQty'],
            'totalAmt': issues['totalAmt'],
            'productCount': issues['productCount'],
            'includeIstInTotals': issues['includeIstInTotals'],
        },
        'classificationConfig': {
            'version': config.get('version'),
            'includeIstInTotals': matcher.get('includeIstInTotals', True),
            'receiptsBuckets': list(RECEIPTS_BUCKET_KEYS),
            'issuesBuckets': list(ISSUES_BUCKET_KEYS),
            'configPath': matcher.get('configPath'),
        },
    }


def empty_receipts_issues_measures() -> dict[str, float | None]:
    return {key: None for key in RECEIPTS_ISSUES_MEASURE_KEYS}


def measures_from_bucket_maps(
    *,
    receipts_by_bucket: Mapping[str, Mapping[str, float | None]] | None,
    issues_by_bucket: Mapping[str, Mapping[str, float | None]] | None,
    include_ist_in_totals: bool = True,
) -> dict[str, float | None]:
    """
    Build raw (unrounded) Receipts/Issues measure dict for one Rule Book product.

    ``*_by_bucket`` maps bucket → {sumOfQuantity, sumOfGross}.
    Totals are SUM of underlying bucket values (optionally excluding IST).
    """
    out = empty_receipts_issues_measures()

    receipts = receipts_by_bucket or {}
    for bucket, (qty_key, amt_key) in RECEIPTS_MEASURE_BY_BUCKET.items():
        entry = receipts.get(bucket) or {}
        out[qty_key] = entry.get('sumOfQuantity')
        out[amt_key] = entry.get('sumOfGross')

    issues = issues_by_bucket or {}
    for bucket, (qty_key, amt_key) in ISSUES_MEASURE_BY_BUCKET.items():
        entry = issues.get(bucket) or {}
        out[qty_key] = entry.get('sumOfQuantity')
        out[amt_key] = entry.get('sumOfGross')

    def _sum_side(
        measure_map: Mapping[str, tuple[str, str]],
        side_buckets: Mapping[str, Mapping[str, float | None]],
    ) -> tuple[float | None, float | None]:
        qty_total = 0.0
        amt_total = 0.0
        present = False
        for bucket, (_qk, _ak) in measure_map.items():
            if bucket == 'ist' and not include_ist_in_totals:
                continue
            entry = side_buckets.get(bucket) or {}
            q = entry.get('sumOfQuantity')
            a = entry.get('sumOfGross')
            if q is not None:
                qty_total += float(q)
                present = True
            if a is not None:
                amt_total += float(a)
                present = True
        if not present:
            return None, None
        return qty_total, amt_total

    r_qty, r_amt = _sum_side(RECEIPTS_MEASURE_BY_BUCKET, receipts)
    i_qty, i_amt = _sum_side(ISSUES_MEASURE_BY_BUCKET, issues)
    out[RECEIPTS_TOTAL_KEYS[0]] = r_qty
    out[RECEIPTS_TOTAL_KEYS[1]] = r_amt
    out[ISSUES_TOTAL_KEYS[0]] = i_qty
    out[ISSUES_TOTAL_KEYS[1]] = i_amt
    return out


def compute_net_movement(
    *,
    opening_qty: float | None,
    opening_amt: float | None,
    purchases_qty: float | None,
    purchases_amt: float | None,
    receipts_total_qty: float | None,
    receipts_total_amt: float | None,
    issues_total_qty: float | None,
    issues_total_amt: float | None,
    sales_qty: float | None,
    sales_amt: float | None,
) -> dict[str, float | None]:
    """
    Product / category net movement (Qty and Amt kept separate):

        Opening + Purchases + Total Receipts − Total Issues − Sales

    Uses Total Receipts/Issues (after classification), never raw MR−DC file totals.
    Missing components treated as 0 only when at least one component is present.
    """
    components_qty = (
        opening_qty,
        purchases_qty,
        receipts_total_qty,
        issues_total_qty,
        sales_qty,
    )
    components_amt = (
        opening_amt,
        purchases_amt,
        receipts_total_amt,
        issues_total_amt,
        sales_amt,
    )

    def _net(parts: tuple[float | None, ...], *, subtract_indexes: set[int]) -> float | None:
        if all(p is None for p in parts):
            return None
        total = 0.0
        for idx, value in enumerate(parts):
            amount = float(value or 0)
            if idx in subtract_indexes:
                total -= amount
            else:
                total += amount
        return total

    # indexes: 0 open, 1 purch, 2 receipts, 3 issues (subtract), 4 sales (subtract)
    return {
        'netMovementQty': _net(components_qty, subtract_indexes={3, 4}),
        'netMovementAmt': _net(components_amt, subtract_indexes={3, 4}),
    }

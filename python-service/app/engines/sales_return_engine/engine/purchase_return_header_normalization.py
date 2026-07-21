"""
Normalize Purchase Return Excel headers into the Sales Return audit internal model.

Supports two upload layouts (auto-detected from headers):
1. Purchase Returns With Invoice Reference — includes Purchase Voucher No
2. Purchase Returns — same columns without Purchase Voucher No

Both are mapped to the same canonical columns the Sales Return engine already expects
(sales_account, product, unit_rate, …). No separate audit path is created.
"""

from __future__ import annotations

from typing import Literal

import polars as pl

PurchaseReturnFormat = Literal['with_invoice_reference', 'standard']

# Normalized Excel headers → Sales Return engine fields
_ACCOUNT_ALIASES = (
    'purchase_return_account',
    'purchase_returns_account',
)

_OPTIONAL_RATE_ALIASES: dict[str, str] = {
    'unitrate': 'unit_rate',
    'rate': 'unit_rate',
    'qty': 'quantity',
    'gross_amt': 'gross_amount',
}


def is_purchase_return_header(labels: set[str]) -> bool:
    """True when the header row looks like a Purchase Return workbook."""
    return any(alias in labels for alias in _ACCOUNT_ALIASES)


def detect_purchase_return_format(labels: set[str]) -> PurchaseReturnFormat | None:
    """
    Detect which Purchase Return layout was uploaded.

    Presence of Purchase Voucher No → with invoice reference; otherwise standard.
    Returns None when the sheet is not a purchase-return layout.
    """
    if not is_purchase_return_header(labels):
        return None
    if 'purchase_voucher_no' in labels:
        return 'with_invoice_reference'
    return 'standard'


def purchase_or_sales_return_account_present(labels: set[str]) -> bool:
    """Header has any account column accepted by the return audit loader."""
    return (
        'sales_account' in labels
        or 'sales_return_account' in labels
        or is_purchase_return_header(labels)
    )


def normalize_purchase_return_dataframe(
    dataframe: pl.DataFrame,
    *,
    display_headers: dict[str, str] | None = None,
) -> tuple[pl.DataFrame, dict[str, str], PurchaseReturnFormat | None]:
    """
    Map Purchase Return columns onto the Sales Return canonical schema.

    - Purchase Return Account / Purchase Returns Account → sales_account
    - Purchase Voucher No kept as purchase_voucher_no when present
    - Missing Purchase Voucher No → purchase_voucher_no = null
    - Account cell text: "purchase return(s)" → "sales" (same idea as sales return rewrite)

    Returns (dataframe, display_headers, detected_format).
    """
    labels = set(dataframe.columns)
    detected = detect_purchase_return_format(labels)
    headers = dict(display_headers or {})

    if detected is None:
        return dataframe, headers, None

    renames: dict[str, str] = {}
    for alias in _ACCOUNT_ALIASES:
        if alias in dataframe.columns and 'sales_account' not in dataframe.columns:
            renames[alias] = 'sales_account'
            break

    for source, target in _OPTIONAL_RATE_ALIASES.items():
        if source in dataframe.columns and target not in dataframe.columns:
            renames[source] = target

    if renames:
        dataframe = dataframe.rename(renames)
        for source, target in renames.items():
            if source in headers and target not in headers:
                headers[target] = headers.pop(source)

    if 'purchase_voucher_no' not in dataframe.columns:
        dataframe = dataframe.with_columns(pl.lit(None).cast(pl.Utf8).alias('purchase_voucher_no'))
        headers.setdefault('purchase_voucher_no', 'Purchase Voucher No')

    if 'sales_account' in dataframe.columns:
        dataframe = dataframe.with_columns(
            pl.col('sales_account')
            .cast(pl.Utf8, strict=False)
            .fill_null('')
            .alias('__upload_sales_account_raw')
        )
        # Strip "purchase return(s)" so ledger mapping reuses sales-account rules.
        dataframe = dataframe.with_columns(
            pl.col('sales_account')
            .cast(pl.Utf8, strict=False)
            .fill_null('')
            .str.replace_all(r'(?i)purchase\s+returns?', 'sales', literal=False)
            .str.replace_all(r'\s+', ' ')
            .str.strip_chars()
            .alias('sales_account')
        )

    return dataframe, headers, detected


def format_detection_log_label(detected: PurchaseReturnFormat | None) -> str | None:
    if detected == 'with_invoice_reference':
        return 'Purchase Returns With Invoice Reference'
    if detected == 'standard':
        return 'Purchase Returns'
    return None

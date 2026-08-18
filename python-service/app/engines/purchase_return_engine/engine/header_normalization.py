"""
Normalize Purchase Return Excel headers for the Purchase Return audit.

Supports two upload layouts (auto-detected from headers):
1. Purchase Returns With Invoice Reference — includes Purchase Voucher No
2. Purchase Returns — same columns without Purchase Voucher No

Maps account columns onto purchase_account so VectorizedSalesEngine runs in
purchase ledger mode (purchase catalog / mappings), not sales.
"""

from __future__ import annotations

from typing import Literal

import polars as pl

PurchaseReturnFormat = Literal['with_invoice_reference', 'standard']

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
    return any(alias in labels for alias in _ACCOUNT_ALIASES)


def detect_purchase_return_format(labels: set[str]) -> PurchaseReturnFormat | None:
    if not is_purchase_return_header(labels):
        return None
    if 'purchase_voucher_no' in labels:
        return 'with_invoice_reference'
    return 'standard'


def purchase_return_account_present(labels: set[str]) -> bool:
    return is_purchase_return_header(labels) or 'purchase_account' in labels


def normalize_purchase_return_dataframe(
    dataframe: pl.DataFrame,
    *,
    display_headers: dict[str, str] | None = None,
) -> tuple[pl.DataFrame, dict[str, str], PurchaseReturnFormat | None]:
    """
    Map Purchase Return columns onto the purchase ledger canonical schema.

    - Purchase Return Account / Purchase Returns Account → purchase_account
    - Purchase Voucher No kept when present; otherwise null column added
    - Account cell text: "purchase return(s)" → "purchase" for purchase mappings
    """
    labels = set(dataframe.columns)
    detected = detect_purchase_return_format(labels)
    headers = dict(display_headers or {})

    if detected is None and 'purchase_account' not in labels:
        return dataframe, headers, None

    renames: dict[str, str] = {}
    for alias in _ACCOUNT_ALIASES:
        if alias in dataframe.columns and 'purchase_account' not in dataframe.columns:
            renames[alias] = 'purchase_account'
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

    if 'purchase_account' in dataframe.columns:
        dataframe = dataframe.with_columns(
            pl.col('purchase_account')
            .cast(pl.Utf8, strict=False)
            .fill_null('')
            .alias('__upload_purchase_account_raw')
        )
        dataframe = dataframe.with_columns(
            pl.col('purchase_account')
            .cast(pl.Utf8, strict=False)
            .fill_null('')
            .str.replace_all(r'(?i)purchase\s+returns?', 'purchase', literal=False)
            .str.replace_all(r'\s+', ' ')
            .str.strip_chars()
            .alias('purchase_account')
        )

    if detected is None and 'purchase_account' in dataframe.columns:
        detected = (
            'with_invoice_reference'
            if dataframe['purchase_voucher_no'].null_count() < dataframe.height
            else 'standard'
        )

    return dataframe, headers, detected


def format_detection_log_label(detected: PurchaseReturnFormat | None) -> str | None:
    if detected == 'with_invoice_reference':
        return 'Purchase Returns With Invoice Reference'
    if detected == 'standard':
        return 'Purchase Returns'
    return None

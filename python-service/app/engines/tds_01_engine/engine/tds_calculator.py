"""TDS @ 0.1% calculations (vectorized pandas groupby)."""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.engines.cash_ledger_engine.parsers.parser import parse_amount
from app.engines.tds_01_engine.config.constants import (
    BRANCH_VOUCHER_TRANSACTION_TYPES,
    PURCHASE_THRESHOLD,
    TDS_RATE,
    TDS_RATE_WITH_PAN,
    TDS_RATE_WITHOUT_PAN,
    TRANSACTION_TYPE_B2B,
    TRANSACTION_TYPE_B2C,
    TRANSACTION_TYPE_MIXED,
)


def _normalize_party(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value != value:  # NaN
        return ''
    text = str(value).strip()
    if not text or text.lower() in {'nan', 'none', 'null'}:
        return ''
    return ' '.join(text.split())


def _normalize_date(value: Any) -> Any:
    if value is None or (isinstance(value, float) and value != value):
        return ''
    if hasattr(value, 'strftime'):
        try:
            return value.strftime('%Y-%m-%d')
        except (ValueError, OSError):
            return str(value)
    text = str(value).strip()
    if not text or text.lower() in {'nan', 'none', 'null'}:
        return ''
    return text


def _normalize_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and value != value):
        return ''
    text = str(value).strip()
    if not text or text.lower() in {'nan', 'none', 'null'}:
        return ''
    return text


def rows_to_dataframe(rows: list[dict[str, Any]]) -> pd.DataFrame:
    """Normalize voucher rows into a typed DataFrame for aggregation."""
    if not rows:
        return pd.DataFrame(
            columns=[
                'voucher_no',
                'date',
                'party',
                'gross_amount',
                'branch',
                'pan',
                '__original_order',
            ]
        )

    frame = pd.DataFrame(rows)
    if 'party' not in frame.columns:
        frame['party'] = ''
    if 'gross_amount' not in frame.columns:
        frame['gross_amount'] = None
    if 'voucher_no' not in frame.columns:
        frame['voucher_no'] = ''
    if 'date' not in frame.columns:
        frame['date'] = ''
    if 'branch' not in frame.columns:
        frame['branch'] = ''
    if 'pan' not in frame.columns:
        frame['pan'] = ''
    if '__original_order' not in frame.columns:
        frame['__original_order'] = range(len(frame))

    frame['party'] = frame['party'].map(_normalize_party)
    frame['date'] = frame['date'].map(_normalize_date)
    frame['branch'] = frame['branch'].map(_normalize_text)
    frame['pan'] = frame['pan'].map(_normalize_text)
    frame['gross_amount'] = frame['gross_amount'].map(parse_amount)
    frame = frame[frame['party'].astype(str).str.len() > 0]
    frame = frame[frame['gross_amount'].notna()]
    frame['__original_order'] = pd.to_numeric(frame['__original_order'], errors='coerce')
    return frame.reset_index(drop=True)


def calculate_party_totals(frame: pd.DataFrame) -> pd.DataFrame:
    """Group by Party and SUM(Gross Amount) → Purchases During Year."""
    if frame.empty:
        return pd.DataFrame(columns=['party', 'purchases_during_year'])

    totals = (
        frame.groupby('party', sort=False, as_index=False)['gross_amount']
        .sum()
        .rename(columns={'gross_amount': 'purchases_during_year'})
    )
    totals['purchases_during_year'] = totals['purchases_during_year'].round(2)
    return totals


def _transaction_type_for_row(row: pd.Series) -> str | None:
    branch = _normalize_text(row.get('branch')).upper()
    voucher = _normalize_text(row.get('voucher_no')).upper()
    voucher_map = BRANCH_VOUCHER_TRANSACTION_TYPES.get(branch)
    if not voucher_map or not voucher:
        return None

    matches = {txn_type for token, txn_type in voucher_map.items() if token in voucher}
    if len(matches) == 1:
        return next(iter(matches))
    return None


def _has_available_pan(values: pd.Series) -> bool:
    return bool(values.map(_normalize_text).astype(bool).any())


def _party_transaction_type(party_rows: pd.DataFrame) -> str:
    transaction_types = party_rows.apply(_transaction_type_for_row, axis=1)
    known_types = set(transaction_types.dropna().tolist())
    if len(known_types) == 1 and transaction_types.notna().all():
        return next(iter(known_types))
    return TRANSACTION_TYPE_MIXED


def _calculate_tds_for_party(
    purchase_during_year: float,
    *,
    transaction_type: str,
    pan_available: bool,
) -> float | None:
    if transaction_type == TRANSACTION_TYPE_MIXED:
        return None
    if purchase_during_year <= PURCHASE_THRESHOLD:
        return 0.0

    rate = TDS_RATE_WITH_PAN if pan_available else TDS_RATE_WITHOUT_PAN
    if transaction_type == TRANSACTION_TYPE_B2B:
        taxable_amount = purchase_during_year
    elif transaction_type == TRANSACTION_TYPE_B2C:
        taxable_amount = purchase_during_year - PURCHASE_THRESHOLD
    else:
        return None
    return round(taxable_amount * float(rate), 2)


def _build_summary_from_transactions(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(
            columns=[
                'party',
                'purchase_during_year',
                'tds',
                'purchases_during_year',
                'tds_deductible',
                'transaction_type',
                'pan_available',
            ]
        )

    rows: list[dict[str, Any]] = []
    for party, party_rows in frame.groupby('party', sort=False):
        purchase_during_year = round(float(party_rows['gross_amount'].sum()), 2)
        transaction_type = _party_transaction_type(party_rows)
        pan_available = _has_available_pan(party_rows['pan'])
        tds = _calculate_tds_for_party(
            purchase_during_year,
            transaction_type=transaction_type,
            pan_available=pan_available,
        )
        rows.append(
            {
                'party': party,
                'purchase_during_year': purchase_during_year,
                'tds': tds,
                'purchases_during_year': purchase_during_year,
                'tds_deductible': tds,
                'transaction_type': transaction_type,
                'pan_available': pan_available,
            }
        )

    summary = pd.DataFrame(rows)
    return summary.sort_values('party', key=lambda s: s.str.lower()).reset_index(drop=True)


def calculate_tds(
    eligible_totals: pd.DataFrame,
    *,
    rate: float = TDS_RATE,
) -> pd.DataFrame:
    """Add TDS Deductible = Purchases During Year × 0.1%."""
    if eligible_totals.empty:
        return pd.DataFrame(columns=['party', 'purchase_during_year', 'tds', 'purchases_during_year', 'tds_deductible'])

    result = eligible_totals.copy()
    result['purchase_during_year'] = result['purchases_during_year']
    result['tds'] = (result['purchases_during_year'].astype(float) * float(rate)).round(2)
    result['tds_deductible'] = result['tds']
    result = result.sort_values('party', key=lambda s: s.str.lower()).reset_index(drop=True)
    return result


def build_tds_report_frames(
    rows: list[dict[str, Any]],
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict[str, Any]]:
    """
    Full calculation pipeline.

    Returns:
        transaction_frame, summary_frame, detailed_frame, metrics
    """
    frame = rows_to_dataframe(rows)
    all_totals = calculate_party_totals(frame)
    all_summary = _build_summary_from_transactions(frame)

    if not all_summary.empty:
        calculated_tds = pd.to_numeric(all_summary['tds'], errors='coerce')
        eligible_parties = set(all_summary.loc[calculated_tds.gt(0), 'party'].tolist())
        summary = all_summary.loc[calculated_tds.gt(0)].copy().reset_index(drop=True)
    else:
        eligible_parties = set()
        calculated_tds = pd.Series(dtype=float)
        summary = all_summary
    if eligible_parties:
        detailed = frame[frame['party'].isin(eligible_parties)].copy()
        detailed = detailed.sort_values('__original_order', kind='mergesort').reset_index(drop=True)
        detailed['date'] = detailed['date'].map(_normalize_date)
        detailed['voucher_no'] = detailed['voucher_no'].map(
            lambda v: '' if v is None or (isinstance(v, float) and v != v) else str(v).strip()
        )
        detailed['branch'] = detailed['branch'].map(
            lambda v: '' if v is None or (isinstance(v, float) and v != v) else str(v).strip()
        )
        detailed['pan'] = detailed['pan'].map(
            lambda v: '' if v is None or (isinstance(v, float) and v != v) else str(v).strip()
        )
        detailed['gross_amount'] = detailed['gross_amount'].astype(float).round(2)
    else:
        detailed = pd.DataFrame(columns=['date', 'voucher_no', 'party', 'gross_amount', 'branch', 'pan'])

    total_parties = int(len(all_totals))
    eligible_count = len(eligible_parties)
    mixed_count = (
        int((all_summary['transaction_type'] == TRANSACTION_TYPE_MIXED).sum())
        if 'transaction_type' in all_summary.columns
        else 0
    )
    numeric_tds = (
        pd.to_numeric(all_summary['tds'], errors='coerce')
        if 'tds' in all_summary.columns
        else pd.Series(dtype=float)
    )
    metrics = {
        'totalRecords': int(len(frame)),
        'totalParties': total_parties,
        'eligibleSuppliers': eligible_count,
        'nonEligibleSuppliers': max(0, total_parties - eligible_count),
        'totalPurchaseAmount': round(float(frame['gross_amount'].sum()), 2) if not frame.empty else 0.0,
        'eligiblePurchaseAmount': (
            round(float(summary.loc[numeric_tds.gt(0), 'purchase_during_year'].sum()), 2)
            if not summary.empty
            else 0.0
        ),
        'totalTdsDeductible': round(float(numeric_tds.fillna(0).sum()), 2) if not summary.empty else 0.0,
        'mixedParties': mixed_count,
        'mixedPartyNames': (
            all_summary.loc[all_summary['transaction_type'] == TRANSACTION_TYPE_MIXED, 'party'].tolist()
            if 'transaction_type' in all_summary.columns
            else []
        ),
        'compliancePercent': (
            round((eligible_count / total_parties) * 100, 2) if total_parties > 0 else 0.0
        ),
    }
    return frame, summary, detailed, metrics

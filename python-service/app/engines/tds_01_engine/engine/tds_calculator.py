"""TDS @ 0.1% calculations (vectorized pandas groupby)."""

from __future__ import annotations

from typing import Any

import pandas as pd

from app.engines.cash_ledger_engine.parsers.parser import parse_amount
from app.engines.tds_01_engine.config.constants import TDS_RATE
from app.engines.tds_01_engine.validators.threshold_validator import filter_eligible_parties


def _normalize_party(value: Any) -> str:
    if value is None:
        return ''
    if isinstance(value, float) and value != value:  # NaN
        return ''
    text = str(value).strip()
    if not text or text.lower() in {'nan', 'none', 'null'}:
        return ''
    return ' '.join(text.split())


def _display_date(value: Any) -> Any:
    if value is None or (isinstance(value, float) and value != value):
        return ''
    if hasattr(value, 'strftime'):
        try:
            return value.strftime('%d-%m-%Y')
        except (ValueError, OSError):
            return str(value)
    text = str(value).strip()
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


def calculate_tds(
    eligible_totals: pd.DataFrame,
    *,
    rate: float = TDS_RATE,
) -> pd.DataFrame:
    """Add TDS Deductible = Purchases During Year × 0.1%."""
    if eligible_totals.empty:
        return pd.DataFrame(columns=['party', 'purchases_during_year', 'tds_deductible'])

    result = eligible_totals.copy()
    result['tds_deductible'] = (result['purchases_during_year'].astype(float) * float(rate)).round(2)
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
    eligible = filter_eligible_parties(all_totals)
    summary = calculate_tds(eligible)

    eligible_parties = set(summary['party'].tolist()) if not summary.empty else set()
    if eligible_parties:
        detailed = frame[frame['party'].isin(eligible_parties)].copy()
        detailed = detailed.sort_values('__original_order', kind='mergesort').reset_index(drop=True)
        detailed['date'] = detailed['date'].map(_display_date)
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
        detailed = pd.DataFrame(
            columns=['voucher_no', 'date', 'party', 'gross_amount', 'branch', 'pan']
        )

    total_parties = int(len(all_totals))
    eligible_count = int(len(summary))
    metrics = {
        'totalRecords': int(len(frame)),
        'totalParties': total_parties,
        'eligibleSuppliers': eligible_count,
        'nonEligibleSuppliers': max(0, total_parties - eligible_count),
        'totalPurchaseAmount': round(float(frame['gross_amount'].sum()), 2) if not frame.empty else 0.0,
        'eligiblePurchaseAmount': (
            round(float(summary['purchases_during_year'].sum()), 2) if not summary.empty else 0.0
        ),
        'totalTdsDeductible': (
            round(float(summary['tds_deductible'].sum()), 2) if not summary.empty else 0.0
        ),
        'compliancePercent': (
            round((eligible_count / total_parties) * 100, 2) if total_parties > 0 else 0.0
        ),
    }
    return frame, summary, detailed, metrics

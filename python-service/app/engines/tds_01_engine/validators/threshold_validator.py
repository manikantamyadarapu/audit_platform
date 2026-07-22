"""Threshold eligibility for TDS @ 0.1%."""

from __future__ import annotations

import pandas as pd

from app.engines.tds_01_engine.config.constants import PURCHASE_THRESHOLD


def filter_eligible_parties(
    party_totals: pd.DataFrame,
    *,
    threshold: float = PURCHASE_THRESHOLD,
) -> pd.DataFrame:
    """
    Keep suppliers where Purchases During Year > threshold.

    Expects columns: party, purchases_during_year
    """
    if party_totals.empty:
        return party_totals.copy()
    return party_totals.loc[
        party_totals['purchases_during_year'].astype(float) > float(threshold)
    ].copy()

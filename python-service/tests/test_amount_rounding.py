from app.engines.financials_engine.engine.amount_rounding import (
    round_amount_whole,
    round_amount_whole_float,
)


def test_half_or_less_stays_on_the_same_integer():
    assert round_amount_whole(10.5) == 10
    assert round_amount_whole(10.49) == 10
    assert round_amount_whole(0.5) == 0
    assert round_amount_whole(0) == 0
    assert round_amount_whole_float(1000.49) == 1000.0


def test_above_half_goes_to_the_next_integer():
    assert round_amount_whole(10.51) == 11
    assert round_amount_whole(0.5001) == 1
    assert round_amount_whole(123.5678) == 124


def test_blank_stays_blank():
    assert round_amount_whole(None) is None
    assert round_amount_whole('') is None

import math

import pandas as pd

from app.utils.header_cleaner import normalize_header


def test_normalize_header_treats_nat_as_empty():
    assert normalize_header(pd.NaT) == ''
    assert normalize_header(float('nan')) == ''
    assert normalize_header(math.nan) == ''


def test_normalize_header_nat_string():
    assert normalize_header('NaT') == ''

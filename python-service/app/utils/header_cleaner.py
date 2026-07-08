import re
from typing import Any, Iterable

import pandas as pd


def normalize_header(header: Any) -> str:
    if header is None or pd.isna(header):
        return ''
    text = str(header).replace('\n', ' ').replace('\r', ' ').strip().lower()
    if text in {'nat', 'nan'}:
        return ''
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')


def normalize_headers(headers: Iterable[str]) -> list[str]:
    return [normalize_header(header) for header in headers]

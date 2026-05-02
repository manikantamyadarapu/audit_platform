import re
from typing import Iterable


def normalize_header(header: str) -> str:
    if header is None:
        return ''
    text = str(header).strip().lower()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')


def normalize_headers(headers: Iterable[str]) -> list[str]:
    return [normalize_header(header) for header in headers]

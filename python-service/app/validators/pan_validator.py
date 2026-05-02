import re

from app.utils.constants import COMMON_EMPTY_VALUES, PAN_REGEX

_pan_pattern = re.compile(PAN_REGEX)


def is_pan_missing(value: object) -> bool:
    if value is None:
        return True
    return str(value).strip().lower() in COMMON_EMPTY_VALUES


def is_pan_valid(value: object) -> bool:
    if value is None:
        return False
    text = str(value).strip().upper()
    return bool(_pan_pattern.match(text))

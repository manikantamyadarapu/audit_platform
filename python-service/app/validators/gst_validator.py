import re

from app.utils.constants import COMMON_EMPTY_VALUES, GST_REGEX

_gst_pattern = re.compile(GST_REGEX)


def is_gst_missing(value: object) -> bool:
    if value is None:
        return True
    return str(value).strip().lower() in COMMON_EMPTY_VALUES


def is_gst_valid(value: object) -> bool:
    if value is None:
        return False
    text = str(value).strip().upper()
    return bool(_gst_pattern.match(text))

from app.utils.constants import COMMON_EMPTY_VALUES, is_acceptable_pan_equivalent


def is_pan_missing(value: object) -> bool:
    if value is None:
        return True
    return str(value).strip().lower() in COMMON_EMPTY_VALUES


def is_pan_valid(value: object) -> bool:
    return is_acceptable_pan_equivalent(value)

"""CSV-backed sales rules with normalized exact/fuzzy lookup helpers."""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

import polars as pl
from rapidfuzz import fuzz, process

FUZZY_PARTIAL_THRESHOLD = 85

_RULES_PATH = Path(__file__).resolve().parents[1] / 'data' / 'master_sales_rules.csv'
_NON_ALNUM_PATTERN = re.compile(r'[^a-z0-9]+')
_BOUNDARY_ONLY_PRODUCT_RULES = frozenset({'916', '999', 'lac', 'dori', 'wax'})


@dataclass(frozen=True, slots=True)
class MasterSalesRule:
    sales_account: str
    product: str
    expected_rate: float | None
    allowed_deviation_percent: float | None
    category: str
    normalized_sales_account: str
    normalized_product: str


@dataclass(frozen=True, slots=True)
class MasterSalesRuleMatch:
    category: str | None
    matched_value: str | None
    expected_rate: float | None
    allowed_deviation_percent: float | None
    used_fuzzy: bool


def normalize_product_name(value: object) -> str:
    return _normalize_rule_text(value)


def normalize_sales_account_name(value: object) -> str:
    return _normalize_rule_text(value)


@lru_cache(maxsize=1)
def load_master_sales_rules() -> tuple[MasterSalesRule, ...]:
    with _RULES_PATH.open('r', encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        required = {
            'sales_account',
            'product',
            'expected_rate',
            'allowed_deviation_percent',
            'category',
        }
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing rule columns: {', '.join(sorted(missing))}")

        rules: list[MasterSalesRule] = []
        for row in reader:
            sales_account = (row.get('sales_account') or '').strip()
            product = (row.get('product') or '').strip()
            category = (row.get('category') or '').strip()
            if not category or (not sales_account and not product):
                continue
            rules.append(
                MasterSalesRule(
                    sales_account=sales_account,
                    product=product,
                    expected_rate=_parse_optional_float(row.get('expected_rate')),
                    allowed_deviation_percent=_parse_optional_float(
                        row.get('allowed_deviation_percent')
                    ),
                    category=category,
                    normalized_sales_account=normalize_sales_account_name(sales_account),
                    normalized_product=normalize_product_name(product),
                )
            )
        return tuple(rules)


def get_product_rules() -> tuple[MasterSalesRule, ...]:
    return tuple(rule for rule in load_master_sales_rules() if rule.normalized_product)


def get_sales_account_rules() -> tuple[MasterSalesRule, ...]:
    return tuple(rule for rule in load_master_sales_rules() if rule.normalized_sales_account)


@lru_cache(maxsize=50_000)
def lookup_product_rule(product: str, *, allow_fuzzy: bool = True) -> MasterSalesRuleMatch:
    normalized_product = normalize_product_name(product)
    if not normalized_product:
        return MasterSalesRuleMatch(None, None, None, None, False)

    exact = _match_product_rule_exact(normalized_product)
    if exact is not None:
        return _rule_match(exact, used_fuzzy=False, matched_value=exact.product)
    if not allow_fuzzy:
        return MasterSalesRuleMatch(None, None, None, None, False)

    fuzzy = _match_product_rule_fuzzy(normalized_product)
    if fuzzy is None:
        return MasterSalesRuleMatch(None, None, None, None, False)
    return _rule_match(fuzzy, used_fuzzy=True, matched_value=fuzzy.product)


@lru_cache(maxsize=20_000)
def lookup_sales_account_rule(
    sales_account: str, *, allow_fuzzy: bool = False
) -> MasterSalesRuleMatch:
    normalized_sales_account = normalize_sales_account_name(sales_account)
    if not normalized_sales_account:
        return MasterSalesRuleMatch(None, None, None, None, False)

    exact = _match_sales_account_rule_exact(normalized_sales_account)
    if exact is not None:
        return _rule_match(exact, used_fuzzy=False, matched_value=exact.sales_account)
    if not allow_fuzzy:
        return MasterSalesRuleMatch(None, None, None, None, False)

    fuzzy = _match_sales_account_rule_fuzzy(normalized_sales_account)
    if fuzzy is None:
        return MasterSalesRuleMatch(None, None, None, None, False)
    return _rule_match(fuzzy, used_fuzzy=True, matched_value=fuzzy.sales_account)


def build_product_rule_lookup_frame(
    products: Iterable[str], *, allow_fuzzy: bool = True
) -> pl.DataFrame:
    rows = []
    for product in sorted({value for value in products if value and str(value).strip()}):
        match = lookup_product_rule(str(product), allow_fuzzy=allow_fuzzy)
        rows.append(
            {
                '__product_text': str(product),
                '__product_normalized': normalize_product_name(product) or None,
                '__product_rule': match.matched_value,
                '__predicted_category': match.category,
                '__product_expected_rate': match.expected_rate,
                '__product_allowed_deviation_percent': match.allowed_deviation_percent,
                '__used_fuzzy': match.used_fuzzy,
            }
        )
    return _lookup_frame(rows, schema=_product_lookup_schema())


def build_sales_account_rule_lookup_frame(
    sales_accounts: Iterable[str], *, allow_fuzzy: bool = False
) -> pl.DataFrame:
    rows = []
    for sales_account in sorted({value for value in sales_accounts if value and str(value).strip()}):
        match = lookup_sales_account_rule(str(sales_account), allow_fuzzy=allow_fuzzy)
        rows.append(
            {
                '__sales_text': str(sales_account),
                '__sales_normalized': normalize_sales_account_name(sales_account) or None,
                '__sales_rule': match.matched_value,
                '__expected_sales_category': match.category,
                '__sales_expected_rate': match.expected_rate,
                '__sales_allowed_deviation_percent': match.allowed_deviation_percent,
                '__sales_used_fuzzy': match.used_fuzzy,
            }
        )
    return _lookup_frame(rows, schema=_sales_lookup_schema())


def build_category_match_sql(
    *, predicted_category_column: str, expected_category_column: str
) -> str:
    predicted = quote_identifier(predicted_category_column)
    expected = quote_identifier(expected_category_column)
    return (
        f"({predicted} IS NOT NULL AND {expected} IS NOT NULL AND {predicted} <> {expected})"
    )


def build_rate_validation_sql(
    *,
    actual_rate_column: str,
    expected_rate_column: str = 'expected_rate',
    allowed_deviation_percent_column: str = 'allowed_deviation_percent',
) -> str:
    actual = quote_identifier(actual_rate_column)
    expected = quote_identifier(expected_rate_column)
    allowed = quote_identifier(allowed_deviation_percent_column)
    deviation_percent = (
        f"(ABS({actual} - {expected}) / NULLIF(ABS({expected}), 0)) * 100.0"
    )
    return (
        f"({actual} IS NOT NULL AND {expected} IS NOT NULL AND {allowed} IS NOT NULL "
        f"AND {deviation_percent} > {allowed})"
    )


def quote_identifier(column: str) -> str:
    return f'"{column.replace(chr(34), chr(34) * 2)}"'


def _normalize_rule_text(value: object) -> str:
    if value is None:
        return ''
    text = str(value).strip().lower()
    if not text:
        return ''
    return ' '.join(_NON_ALNUM_PATTERN.sub(' ', text).split())


def _parse_optional_float(value: str | None) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return float(text)


def _rule_match(
    rule: MasterSalesRule, *, used_fuzzy: bool, matched_value: str
) -> MasterSalesRuleMatch:
    return MasterSalesRuleMatch(
        category=rule.category,
        matched_value=matched_value,
        expected_rate=rule.expected_rate,
        allowed_deviation_percent=rule.allowed_deviation_percent,
        used_fuzzy=used_fuzzy,
    )


def _match_product_rule_exact(normalized_product: str) -> MasterSalesRule | None:
    for rule in get_product_rules():
        if rule.normalized_product == normalized_product:
            return rule
    for rule in get_product_rules():
        candidate = rule.normalized_product
        if not candidate:
            continue
        if candidate in _BOUNDARY_ONLY_PRODUCT_RULES:
            if re.search(rf'\b{re.escape(candidate)}\b', normalized_product):
                return rule
            continue
        if candidate in normalized_product:
            return rule
    return None


def _match_sales_account_rule_exact(normalized_sales_account: str) -> MasterSalesRule | None:
    for rule in get_sales_account_rules():
        if rule.normalized_sales_account == normalized_sales_account:
            return rule
    for rule in get_sales_account_rules():
        candidate = rule.normalized_sales_account
        if candidate and candidate in normalized_sales_account:
            return rule
    return None


def _match_product_rule_fuzzy(normalized_product: str) -> MasterSalesRule | None:
    hit = process.extractOne(
        normalized_product,
        _product_fuzzy_choices(),
        scorer=fuzz.partial_ratio,
        score_cutoff=FUZZY_PARTIAL_THRESHOLD,
    )
    if hit is None:
        return None
    matched = str(hit[0])
    return _product_choice_map().get(matched)


def _match_sales_account_rule_fuzzy(normalized_sales_account: str) -> MasterSalesRule | None:
    hit = process.extractOne(
        normalized_sales_account,
        _sales_account_fuzzy_choices(),
        scorer=fuzz.partial_ratio,
        score_cutoff=FUZZY_PARTIAL_THRESHOLD,
    )
    if hit is None:
        return None
    matched = str(hit[0])
    return _sales_account_choice_map().get(matched)


@lru_cache(maxsize=1)
def _product_choice_map() -> dict[str, MasterSalesRule]:
    choice_map: dict[str, MasterSalesRule] = {}
    for rule in get_product_rules():
        choice_map.setdefault(rule.normalized_product, rule)
    return choice_map


@lru_cache(maxsize=1)
def _sales_account_choice_map() -> dict[str, MasterSalesRule]:
    choice_map: dict[str, MasterSalesRule] = {}
    for rule in get_sales_account_rules():
        choice_map.setdefault(rule.normalized_sales_account, rule)
    return choice_map


@lru_cache(maxsize=1)
def _product_fuzzy_choices() -> tuple[str, ...]:
    return tuple(_product_choice_map().keys())


@lru_cache(maxsize=1)
def _sales_account_fuzzy_choices() -> tuple[str, ...]:
    return tuple(_sales_account_choice_map().keys())


def _lookup_frame(
    rows: list[dict[str, object]], *, schema: dict[str, pl.DataType]
) -> pl.DataFrame:
    if rows:
        return pl.DataFrame(rows, schema_overrides=schema)
    return pl.DataFrame(schema=schema)


def _product_lookup_schema() -> dict[str, pl.DataType]:
    return {
        '__product_text': pl.Utf8,
        '__product_normalized': pl.Utf8,
        '__product_rule': pl.Utf8,
        '__predicted_category': pl.Utf8,
        '__product_expected_rate': pl.Float64,
        '__product_allowed_deviation_percent': pl.Float64,
        '__used_fuzzy': pl.Boolean,
    }


def _sales_lookup_schema() -> dict[str, pl.DataType]:
    return {
        '__sales_text': pl.Utf8,
        '__sales_normalized': pl.Utf8,
        '__sales_rule': pl.Utf8,
        '__expected_sales_category': pl.Utf8,
        '__sales_expected_rate': pl.Float64,
        '__sales_allowed_deviation_percent': pl.Float64,
        '__sales_used_fuzzy': pl.Boolean,
    }

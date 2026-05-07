"""Product text → gold/jadau category using keyword rules + rapidfuzz fallback."""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Final

from rapidfuzz import fuzz, process

FUZZY_PARTIAL_THRESHOLD: Final[int] = 85

_CATEGORY_ORDER: Final[tuple[str, ...]] = ('jadau', '24k', '22k', '18k', '14k')

_KEYWORDS: Final[dict[str, tuple[str, ...]]] = {
    'jadau': ('jadau',),
    '24k': (
        '24k',
        '24 kt',
        '24kt',
        '24 carat',
        '24carat',
        '999 gold',
    ),
    '22k': (
        '22k',
        '22 kt',
        '22kt',
        '22 carat',
        '22carat',
        '916 gold',
        'black beads',
        'gold ornament',
        'gold ornaments',
    ),
    '18k': (
        '18k',
        '18 kt',
        '18kt',
        '18 carat',
        '18carat',
    ),
    '14k': (
        '14k',
        '14 kt',
        '14kt',
        '14 carat',
        '14carat',
    ),
}

_STANDALONE_916: Final[re.Pattern[str]] = re.compile(r'(?<!\d)916(?!\d)')
_STANDALONE_999: Final[re.Pattern[str]] = re.compile(r'(?<!\d)999(?!\d)')

# Avoid substring false positives (e.g. "necklace" containing "lac").
_22K_BOUNDARY_TOKENS: Final[tuple[str, ...]] = ('lac', 'dori', 'wax')
_22K_BOUNDARY_PATTERNS: Final[tuple[re.Pattern[str], ...]] = tuple(
    re.compile(rf'\b{re.escape(t)}\b') for t in _22K_BOUNDARY_TOKENS
)

_FUZZ_PHRASES: Final[dict[str, tuple[str, ...]]] = {
    'jadau': ('jadau', 'jadau necklace', 'jadau haram', 'jadau earrings'),
    '24k': ('24k', '24 kt', '24kt', '24 carat', '24carat', '999 gold', '999'),
    '22k': (
        '22k',
        '22 kt',
        '22kt',
        '916',
        '916 gold',
        'black beads',
        'dori',
        'lac',
        'gold ornament',
        'gold ornaments',
        'wax',
    ),
    '18k': ('18k', '18 kt', '18kt', '18 carat', '18carat'),
    '14k': ('14k', '14 kt', '14kt', '14 carat', '14carat'),
}

_FUZZ_REFERENCES: Final[list[tuple[str, str]]] = [
    (cat, phrase) for cat in _CATEGORY_ORDER for phrase in _FUZZ_PHRASES[cat]
]

_PHRASE_TO_CATEGORY: Final[dict[str, str]] = {}
for cat, phrase in _FUZZ_REFERENCES:
    _PHRASE_TO_CATEGORY.setdefault(phrase, cat)

_FUZZ_CHOICE_LIST: Final[list[str]] = list(_PHRASE_TO_CATEGORY.keys())

def _normalize(text: str) -> str:
    return text.lower().strip()


def _direct_hit(category: str, prod_norm: str) -> bool:
    if category == '24k' and _STANDALONE_999.search(prod_norm):
        return True
    if category == '22k' and _STANDALONE_916.search(prod_norm):
        return True
    for kw in _KEYWORDS[category]:
        if kw in prod_norm:
            return True
    return False


def direct_category_from_product_normalized(prod_norm: str) -> str | None:
    """Keyword-only classification on already-normalized product text."""
    if not prod_norm:
        return None
    for cat in _CATEGORY_ORDER:
        if _direct_hit(cat, prod_norm):
            return cat
    return None


def classify_product_direct(product: str) -> str | None:
    """Keyword-only classification (no fuzzy)."""
    if not product or not str(product).strip():
        return None
    return direct_category_from_product_normalized(_normalize(str(product)))


def _fuzzy_best_category(prod_norm: str) -> tuple[str | None, int]:
    """Single C++-accelerated pass via rapidfuzz.process (avoid ~30 Python partial_ratio loops per row)."""
    hit = process.extractOne(
        prod_norm,
        _FUZZ_CHOICE_LIST,
        scorer=fuzz.partial_ratio,
        score_cutoff=FUZZY_PARTIAL_THRESHOLD,
    )
    if hit is None:
        return None, -1
    phrase = hit[0]
    score = int(hit[1])
    cat = _PHRASE_TO_CATEGORY.get(phrase)
    if cat is None:
        return None, -1
    return cat, score


def classify_product_with_detail(product: str) -> tuple[str | None, bool]:
    """
    Returns (category, used_fuzzy).

    If direct keywords match, fuzzy is False.
    If direct misses but fuzzy partial_ratio >= threshold, fuzzy is True.
    """
    if not product or not str(product).strip():
        return None, False
    prod_norm = _normalize(str(product))
    direct = direct_category_from_product_normalized(prod_norm)
    if direct is not None:
        return direct, False
    fuzzy_cat, score = _fuzzy_best_category(prod_norm)
    if fuzzy_cat is not None and score >= FUZZY_PARTIAL_THRESHOLD:
        return fuzzy_cat, True
    return None, False


def classify_product(product: str) -> str | None:
    """Public API: predicted category from product text, or None."""
    cat, _ = classify_product_with_detail(product)
    return cat


@lru_cache(maxsize=50_000)
def classify_product_cached(product: str) -> tuple[str | None, bool]:
    """Cached classification for repeated product strings in large ledgers."""
    return classify_product_with_detail(product)


@lru_cache(maxsize=8192)
def expected_category_from_sales_account(sales_account: str) -> str | None:
    """
    Detect ledger category from sales account label.
    jadau is checked before karat markers.
    """
    if not sales_account or not str(sales_account).strip():
        return None
    sa = _normalize(str(sales_account))
    if 'jadau' in sa:
        return 'jadau'
    if '24k' in sa:
        return '24k'
    if '22k' in sa:
        return '22k'
    if '18k' in sa:
        return '18k'
    if '14k' in sa:
        return '14k'
    return None

"""Closing Stock product → sheet/subcategory mapping from the JSON Rule Book."""

from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import OrderedDict
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.engines.financials_engine.engine.closing_stock_template import (
    CATEGORIES_WITH_SUBCATEGORIES,
    CLOSING_STOCK_CATEGORIES,
    subcategory_total_label,
)
from app.engines.financials_engine.engine.opening_stock import (
    apply_fallback_opening_to_layout,
    build_opening_measures_for_layout,
    norm_opening_product_name,
    product_identity_key,
)
from app.utils.logger import get_logger

_RULE_BOOK_PATH = Path(__file__).resolve().parent / 'closing_stock_product_rule_book.json'

_SHEET_KEY_ALIASES: dict[str, str] = {
    'Precious': 'Precious and Semi Precious',
}

# Exact sheet labels from Sales/Purchases Category and previous-year tabs. Not fuzzy.
_SHEET_NORM_ALIASES: dict[str, str] = {
    'diamond': 'Diamond',
    'diamonds': 'Diamond',
    'dia': 'Diamond',
    'emerald': 'Emerald',
    'emeralds': 'Emerald',
    'eme': 'Emerald',
    'pearls': 'Pearls',
    'pearl': 'Pearls',
    'prls': 'Pearls',
    'rubie': 'Rubie',
    'rubies': 'Rubie',
    'ruby': 'Rubie',
    'rubi': 'Rubie',
    'precious and semi precious': 'Precious and Semi Precious',
    'precious': 'Precious and Semi Precious',
    'prec': 'Precious and Semi Precious',
}

_UNICODE_WS = re.compile(
    r'[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+',
    re.UNICODE,
)
_NON_ALNUM = re.compile(r'[^a-z0-9]+', re.IGNORECASE)


def _norm_product(name: str) -> str:
    """Normalize for comparison only — display names stay as in the Rule Book."""
    return norm_opening_product_name(name)


def _match_key(name: str) -> str:
    """
    Alphanumeric-only key — ignores spaces/punctuation differences.

    "Flat polki FP1" and "Flatpolki FP 1" → flatpolkifp1
    "Pearls JPS 1000" and "PearlsJPS 1000" → pearlsjps1000
    """
    return _NON_ALNUM.sub('', _norm_product(name))


_SYNTHETIC_WORDS = frozenset({'synthetic', 'sythetic'})


def _cleaned_product_tokens(name: str) -> list[str]:
    tokens = _norm_product(name).replace('.', ' ').split()
    cleaned = [_NON_ALNUM.sub('', token) for token in tokens]
    return [token for token in cleaned if token]


def _canonical_code_tokens(tokens: list[str]) -> list[str]:
    """SYN and JSY are one Synthetic Stones code: Synthetic SYN 100 → JSY 100."""
    if not any(token in _SYNTHETIC_WORDS for token in tokens):
        return tokens
    return ['jsy' if token == 'syn' else token for token in tokens]


def _core_sku_key(name: str) -> str:
    """
    Trailing product-code key used when Rule Book adds a category prefix.

    "Pearls JPS 1000" / "JPS 1000" → jps1000
    "Synthetic JSY 100" / "Synthetic SYN 100" / "JSY 100" → jsy100
    "Flat polki FP 1" / "FP 1" / "FP1" → fp1
    """
    cleaned = _canonical_code_tokens(_cleaned_product_tokens(name))
    if not cleaned:
        return ''
    digit_idx = None
    for i in range(len(cleaned) - 1, -1, -1):
        if any(ch.isdigit() for ch in cleaned[i]):
            digit_idx = i
            break
    if digit_idx is None:
        return ''.join(cleaned)
    start = digit_idx
    if start > 0 and cleaned[start - 1].isalpha():
        start -= 1
    return ''.join(cleaned[start:])


def _coerce_measure(value: Any) -> float | None:
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _opening_balance_blank_or_zero(row: Mapping[str, Any]) -> bool:
    qty = _coerce_measure(
        row.get('sumOfQuantity') if row.get('sumOfQuantity') is not None else row.get('openingQty')
    )
    return qty is None or qty == 0


def _round_closing_stock_measure(value: float | None) -> float | None:
    """
    Round a Closing Stock display value to the nearest whole number.

    Decimal < 0.5 → down; decimal >= 0.5 → up.
    Used for product cells and for the final TOTAL after summing unrounded values.
    """
    if value is None:
        return None
    return float(Decimal(str(value)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _clean_product_list(entries: Sequence[Any]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for item in entries:
        name = str(item).strip()
        if not name:
            continue
        key = _norm_product(name)
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(name)
    return cleaned


def load_closing_stock_product_rule_book(
    path: Path | None = None,
) -> dict[str, Any]:
    """
    Load the Rule Book from disk on every call — no in-memory cache.

    The JSON file is the single source of truth for product names and hierarchy.
    """
    target = path or _RULE_BOOK_PATH
    if not target.exists():
        raise FileNotFoundError(f'Closing Stock product Rule Book not found: {target}')

    raw = json.loads(target.read_text(encoding='utf-8'))
    if not isinstance(raw, dict):
        raise ValueError('Closing Stock product Rule Book must be a JSON object')

    normalized_raw: dict[str, Any] = {}
    for key, value in raw.items():
        sheet = _SHEET_KEY_ALIASES.get(str(key).strip(), str(key).strip())
        if sheet in normalized_raw and str(key).strip() != sheet:
            continue
        normalized_raw[sheet] = value

    book: dict[str, Any] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        entries = normalized_raw.get(category)
        if entries is None:
            book[category] = []
            continue
        if isinstance(entries, list):
            book[category] = _clean_product_list(entries)
            continue
        if isinstance(entries, dict):
            subcats: dict[str, list[str]] = {}
            for sub_name, products in entries.items():
                label = str(sub_name).strip()
                if not label:
                    continue
                if not isinstance(products, list):
                    raise ValueError(
                        f'Rule Book subcategory "{category}" / "{label}" must be a list of products'
                    )
                subcats[label] = _clean_product_list(products)
            book[category] = subcats
            continue
        raise ValueError(
            f'Rule Book group "{category}" must be a product list or subcategory object'
        )
    return book


def compute_rule_book_fingerprint(rule_book: Mapping[str, Any] | None = None) -> str:
    """Stable hash of the normalized Rule Book — changes when JSON is edited."""
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    payload = json.dumps(book, sort_keys=True, ensure_ascii=False, separators=(',', ':'))
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def get_closing_stock_rule_book_payload() -> dict[str, Any]:
    """Current Rule Book JSON plus metadata for API clients (always re-reads disk)."""
    book = load_closing_stock_product_rule_book()
    counts = count_rule_book_products(book)
    mtime = None
    try:
        mtime = _RULE_BOOK_PATH.stat().st_mtime
    except OSError:
        mtime = None
    return {
        'ruleBook': book,
        'ruleBookFingerprint': compute_rule_book_fingerprint(book),
        'ruleBookProductCounts': counts,
        'ruleBookProductTotal': sum(counts.values()),
        'ruleBookPath': str(_RULE_BOOK_PATH),
        'ruleBookMtime': mtime,
        'categories': list(CLOSING_STOCK_CATEGORIES),
    }


def format_closing_stock_mapping_response(category_mapping: Mapping[str, Any]) -> dict[str, Any]:
    """Shape returned to UI / remap endpoint (always from current Rule Book)."""
    return {
        'productsByCategory': category_mapping['productsByCategory'],
        'layoutByCategory': category_mapping['layoutByCategory'],
        'salesByCategory': category_mapping['salesByCategory'],
        'purchasesByCategory': category_mapping['purchasesByCategory'],
        'unmappedProducts': category_mapping['unmappedProducts'],
        'unmappedProductDetails': category_mapping.get('unmappedProductDetails', []),
        'unmappedOpeningProducts': category_mapping.get('unmappedOpeningProducts', []),
        'mappedOpeningProducts': category_mapping.get('mappedOpeningProducts', []),
        'closingStockCategories': category_mapping['categories'],
        'ruleBookFingerprint': category_mapping.get('ruleBookFingerprint'),
        'ruleBookProductCounts': category_mapping.get('ruleBookProductCounts', {}),
        'ruleBookProductTotal': category_mapping.get('ruleBookProductTotal', 0),
        'productsWithSalesData': category_mapping.get('productsWithSalesData', 0),
        'productsWithPurchaseData': category_mapping.get('productsWithPurchaseData', 0),
        'productsWithOpeningData': category_mapping.get('productsWithOpeningData', 0),
        'productsDisplayed': category_mapping.get('productsDisplayed', 0),
        'reconciliation': category_mapping.get('reconciliation', {}),
        'receiptAmountReview': category_mapping.get('receiptAmountReview', []),
        'productAverageRates': category_mapping.get('productAverageRates', []),
    }


def count_rule_book_products(rule_book: Mapping[str, Any] | None = None) -> dict[str, int]:
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    counts: dict[str, int] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        section = book.get(category)
        if isinstance(section, list):
            counts[category] = len(section)
        elif isinstance(section, dict):
            counts[category] = sum(len(products) for products in section.values())
        else:
            counts[category] = 0
    return counts


def build_product_location_index(
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, tuple[str, str | None]]:
    """
    Reverse index for pivot → Rule Book location.

    Keys include:
      - whitespace-normalized name
      - alphanumeric match key
      - core SKU key (only when unique across the Rule Book)
    Values are (sheet_name, subcategory_or_None).
    """
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    entries: list[tuple[str, str, str | None]] = []
    for category in CLOSING_STOCK_CATEGORIES:
        section = book.get(category)
        if isinstance(section, list):
            for product in section:
                entries.append((product, category, None))
        elif isinstance(section, dict):
            for subcategory, products in section.items():
                for product in products:
                    entries.append((product, category, subcategory))

    core_owners: dict[str, list[tuple[str, str | None]]] = {}
    for product, category, subcategory in entries:
        core = _core_sku_key(product)
        if core:
            core_owners.setdefault(core, []).append((category, subcategory))

    index: dict[str, tuple[str, str | None]] = {}
    for product, category, subcategory in entries:
        loc = (category, subcategory)
        for key in (_norm_product(product), _match_key(product)):
            if key and key not in index:
                index[key] = loc
        core = _core_sku_key(product)
        if core and len(core_owners.get(core, [])) == 1 and core not in index:
            index[core] = loc
    return index


def resolve_product_location(
    product: str,
    *,
    index: Mapping[str, tuple[str, str | None]] | None = None,
) -> tuple[str, str | None] | None:
    """
    Map a Sales/Purchases pivot name onto a Rule Book location.

    Matching order (never changes the displayed Rule Book name):
      1. whitespace-normalized equality
      2. alphanumeric equality (spacing/punctuation insensitive)
      3. unique core SKU (handles category-prefix renames)
    """
    lookup = index if index is not None else build_product_location_index()
    for key in (_norm_product(product), _match_key(product), _core_sku_key(product)):
        if key and key in lookup:
            return lookup[key]
    return None


def build_product_to_category_index(
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, str]:
    return {key: loc[0] for key, loc in build_product_location_index(rule_book).items()}


def resolve_product_category(
    product: str,
    *,
    index: Mapping[str, str] | None = None,
) -> str | None:
    if index is not None:
        for key in (_norm_product(product), _match_key(product), _core_sku_key(product)):
            if key and key in index:
                return index[key]
        return None
    loc = resolve_product_location(product)
    return loc[0] if loc else None


def _empty_measures() -> dict[str, float | None]:
    return {'sumOfQuantity': None, 'sumOfGross': None}


def _accumulate_measures(
    entry: dict[str, float | None],
    *,
    qty: float | None,
    gross: float | None,
) -> None:
    if qty is not None:
        entry['sumOfQuantity'] = (entry['sumOfQuantity'] or 0.0) + qty
    if gross is not None:
        entry['sumOfGross'] = (entry['sumOfGross'] or 0.0) + gross


def _iter_rule_book_products(
    rule_book: Mapping[str, Any],
) -> list[tuple[str, str | None, str]]:
    """Flatten Rule Book to (category, subcategory, display_name)."""
    rows: list[tuple[str, str | None, str]] = []
    for category in CLOSING_STOCK_CATEGORIES:
        section = rule_book.get(category)
        if isinstance(section, list):
            for product in section:
                rows.append((category, None, product))
        elif isinstance(section, dict):
            for subcategory, products in section.items():
                for product in products:
                    rows.append((category, subcategory, product))
    return rows


def _build_rule_book_match_lookup(
    rule_book: Mapping[str, Any],
) -> dict[str, str]:
    """Map normalized pivot keys → Rule Book display name (one claim per pivot row)."""
    products = _iter_rule_book_products(rule_book)
    core_owners: dict[str, list[str]] = {}
    for _category, _subcategory, display_name in products:
        core = _core_sku_key(display_name)
        if core:
            core_owners.setdefault(core, []).append(display_name)

    lookup: dict[str, str] = {}
    for _category, _subcategory, display_name in products:
        for key in (
            _norm_product(display_name),
            _match_key(display_name),
            product_identity_key(display_name),
        ):
            if key and key not in lookup:
                lookup[key] = display_name
        core = _core_sku_key(display_name)
        if core and len(core_owners.get(core, [])) == 1 and core not in lookup:
            lookup[core] = display_name
    return lookup


def _resolve_rule_book_display_name(
    pivot_product: str,
    *,
    lookup: Mapping[str, str],
) -> str | None:
    for key in (
        _norm_product(pivot_product),
        _match_key(pivot_product),
        product_identity_key(pivot_product),
        _core_sku_key(pivot_product),
    ):
        if key and key in lookup:
            return lookup[key]
    return None


def resolve_rule_book_display_name(
    product: str,
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> str | None:
    """Public helper — map a product label to its Rule Book display name."""
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    lookup = _build_rule_book_match_lookup(book)
    return _resolve_rule_book_display_name(product, lookup=lookup)


def iter_mr_dc_rows(
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None,
) -> list[tuple[str, Mapping[str, Any]]]:
    """Product rows from MR and DC location pivots. Quantity columns are left unchanged."""
    found: list[tuple[str, Mapping[str, Any]]] = []
    for source, tree in (('MR', mr_pivots), ('DC', dc_pivots)):
        if not isinstance(tree, Mapping):
            continue
        for rows in tree.values():
            if not isinstance(rows, Sequence) or isinstance(rows, (str, bytes)):
                continue
            for row in rows:
                if isinstance(row, Mapping) and str(row.get('product') or '').strip():
                    found.append((source, row))
    return found


def _trading_account_product(product: str) -> bool:
    """Gold and silver products are on the Trading sheet, not the jewel sheets."""
    from app.engines.financials_engine.engine.metal_trading import resolve_metal_trading_account

    return resolve_metal_trading_account(product) is not None


def _row_text(row: Mapping[str, Any], key: str) -> str:
    return str(row.get(key) or '').strip()


def _resolve_closing_stock_sheet(label: str) -> str | None:
    text = str(label or '').strip()
    if not text:
        return None
    if text in CLOSING_STOCK_CATEGORIES:
        return text
    aliased = _SHEET_KEY_ALIASES.get(text)
    if aliased in CLOSING_STOCK_CATEGORIES:
        return aliased
    return _SHEET_NORM_ALIASES.get(_norm_product(text))


def _unique_subcategory_location(
    label: str,
    rule_book: Mapping[str, Any],
) -> tuple[str, str] | None:
    key = _norm_product(label)
    if not key:
        return None
    hits: list[tuple[str, str]] = []
    for category in CLOSING_STOCK_CATEGORIES:
        section = rule_book.get(category)
        if not isinstance(section, dict):
            continue
        for subcategory in section:
            sub_label = str(subcategory or '').strip()
            if sub_label and _norm_product(sub_label) == key:
                hits.append((category, sub_label))
    if len(hits) == 1:
        return hits[0]
    return None


def _location_from_file_labels(
    category_label: str,
    subcategory_label: str | None,
    *,
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None] | None:
    sub = str(subcategory_label or '').strip() or None
    sheet = _resolve_closing_stock_sheet(category_label)
    if sheet:
        return sheet, sub
    unique = _unique_subcategory_location(category_label, rule_book)
    if unique is None:
        return None
    if sub is None:
        return unique
    return unique[0], sub


def _product_family_key(name: str) -> str:
    """Product line without the trailing size number. Display names are unchanged."""
    cleaned = _canonical_code_tokens(_cleaned_product_tokens(name))
    while cleaned and cleaned[-1].isdigit():
        cleaned.pop()
    return ''.join(cleaned)


def _unique_locations(
    hits: Sequence[tuple[str, str | None]],
) -> tuple[str, str | None] | None:
    unique = set(hits)
    if len(unique) == 1:
        return unique.pop()
    return None


def _location_from_existing_product_family(
    product: str,
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None] | None:
    """
    Place a file product on the sheet already used by that product line.

    "Emeralds JEM 5300" follows "Emeralds JEM 100". Names with no existing line stay unplaced.
    """
    family = _product_family_key(product)
    if len(family) < 3:
        return None
    hits = [
        (category, subcategory)
        for category, subcategory, display in _iter_rule_book_products(rule_book)
        if _product_family_key(display) == family
    ]
    return _unique_locations(hits)


def _prefix_product_line(
    product: str,
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None, str] | None:
    """Longest unique Rule Book prefix, e.g. "Chakri a" → Chakri."""
    norm = _norm_product(product)
    if not norm:
        return None
    best_len = 0
    hits: list[tuple[str, str | None, str]] = []
    for category, subcategory, display in _iter_rule_book_products(rule_book):
        label = _norm_product(display)
        if not label or not norm.startswith(f'{label} '):
            continue
        if len(label) > best_len:
            best_len = len(label)
            hits = [(category, subcategory, display)]
        elif len(label) == best_len:
            hits.append((category, subcategory, display))
    locations = {(category, subcategory) for category, subcategory, _display in hits}
    if len(locations) != 1:
        return None
    if len(hits) == 1:
        return hits[0]
    category, subcategory = locations.pop()
    return category, subcategory, str(product).strip()


def _location_from_rule_book_name_prefix(
    product: str,
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None] | None:
    """Place "Chakri a" with "Chakri" when that Rule Book name is a unique prefix."""
    line = _prefix_product_line(product, rule_book)
    if line is None:
        norm = _norm_product(product)
        if not norm:
            return None
        hits = [
            (category, subcategory)
            for category, subcategory, display in _iter_rule_book_products(rule_book)
            if _norm_product(display) == norm
        ]
        return _unique_locations(hits)
    return line[0], line[1]


def resolve_known_product_line(
    product: str,
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None, str] | None:
    """
    Basheerbagh placement for a name that is not an exact Rule Book entry.

    Prefix wins ("Chakri a" → Chakri). Otherwise the family location is used and
    the quantity-file name stays the display name ("Flat polki FP 16").
    """
    prefix = _prefix_product_line(product, rule_book)
    if prefix is not None:
        return prefix
    location = _location_from_existing_product_family(product, rule_book)
    if location is None:
        return None
    return location[0], location[1], str(product).strip()


def _location_from_known_product_line(
    product: str,
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None] | None:
    return _location_from_existing_product_family(
        product, rule_book
    ) or _location_from_rule_book_name_prefix(product, rule_book)


def _code_sheet_location(product: str) -> tuple[str, str | None] | None:
    """Same product-to-sheet rules as Jubilee Hills. The Rule Book is not used."""
    from app.engines.financials_engine.engine.jubilee_hills_placement import (
        locate_jubilee_hills_product,
    )

    found = locate_jubilee_hills_product(product)
    if found is None:
        return None
    return found[0]


def _previous_year_sheet_location(row: Mapping[str, Any]) -> tuple[str, str | None] | None:
    """Opening-only sheet from last year. Diamond is assigned only by a Diamond regex."""
    from app.engines.financials_engine.engine.jubilee_hills_placement import DIAMOND_SHEET

    subcategory = _row_text(row, 'subcategory') or None
    for key in ('category', 'sheetName'):
        sheet = _resolve_closing_stock_sheet(_row_text(row, key))
        if sheet and sheet != DIAMOND_SHEET:
            return sheet, subcategory
    return None


def _sales_purchases_location(
    product: str,
    row: Mapping[str, Any],
    *,
    location_index: Mapping[str, tuple[str, str | None]],
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None] | None:
    del row, location_index, rule_book
    return _code_sheet_location(product)


def _opening_only_location(
    product: str,
    row: Mapping[str, Any],
    *,
    location_index: Mapping[str, tuple[str, str | None]],
    rule_book: Mapping[str, Any],
) -> tuple[str, str | None] | None:
    del location_index, rule_book
    loc = _code_sheet_location(product)
    if loc is not None:
        return loc
    return _previous_year_sheet_location(row)


class _IncrementalProductLookup:
    """Same name index as rebuilding the Rule Book lookup after every added product.

    Name keys keep the first product that claimed them. A core code is added only
    while exactly one product owns it, and a later name key replaces that core key.
    """

    def __init__(self) -> None:
        self.lookup: dict[str, str] = {}
        self._core_owners: dict[str, list[str]] = {}
        self._core_only: set[str] = set()

    def add(self, display_name: str) -> None:
        for key in (
            _norm_product(display_name),
            _match_key(display_name),
            product_identity_key(display_name),
        ):
            if not key:
                continue
            if key in self._core_only:
                del self.lookup[key]
                self._core_only.discard(key)
            if key not in self.lookup:
                self.lookup[key] = display_name
        core = _core_sku_key(display_name)
        if not core:
            return
        owners = self._core_owners.setdefault(core, [])
        owners.append(display_name)
        if len(owners) == 1:
            if core not in self.lookup:
                self.lookup[core] = display_name
                self._core_only.add(core)
            return
        if core in self._core_only:
            del self.lookup[core]
            self._core_only.discard(core)


def _lookup_from_entries(
    entries: Sequence[tuple[str, str, str | None]],
) -> dict[str, str]:
    book: dict[str, Any] = {category: [] for category in CLOSING_STOCK_CATEGORIES}
    for name, category, _sub in entries:
        if category in book:
            book[category].append(name)
    return _build_rule_book_match_lookup(book)


def _catalog_to_rule_book(
    entries: Sequence[tuple[str, str, str | None]],
) -> dict[str, Any]:
    grouped: dict[str, OrderedDict[str, list[str]]] = {
        category: OrderedDict() for category in CLOSING_STOCK_CATEGORIES
    }
    plains: dict[str, list[str]] = {category: [] for category in CLOSING_STOCK_CATEGORIES}
    for name, category, subcategory in entries:
        if category not in grouped:
            continue
        sub = str(subcategory or '').strip()
        if sub:
            grouped[category].setdefault(sub, []).append(name)
        else:
            plains[category].append(name)

    book: dict[str, Any] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        has_groups = bool(grouped[category])
        has_plain = bool(plains[category])
        if has_groups and not has_plain:
            book[category] = dict(grouped[category])
        elif has_plain and not has_groups:
            book[category] = plains[category]
        elif has_groups and has_plain:
            section = OrderedDict(grouped[category])
            section[''] = plains[category]
            book[category] = dict(section)
        elif category in CATEGORIES_WITH_SUBCATEGORIES:
            book[category] = {}
        else:
            book[category] = []
    return book


def _catalog_display_for(name: str, lookup: Mapping[str, str]) -> str | None:
    text = str(name or '').strip()
    if not text:
        return None
    if text in lookup.values():
        return text
    return _resolve_rule_book_display_name(text, lookup=lookup)


def _try_add_opening_row(
    row: Mapping[str, Any],
    *,
    entries: list[tuple[str, str, str | None]],
    unplaced: list[dict[str, Any]],
    location_index: Mapping[str, tuple[str, str | None]],
    rule_book: Mapping[str, Any],
    names: _IncrementalProductLookup,
) -> None:
    """
    Add an Opening Quantity product that is not already in Sales/Purchases.

    A confirmed manual/fallback mapping keeps a single row on ruleBookProduct.
    If that mapped product is already in the catalog, the quantity-file label is not added.
    """
    product = _row_text(row, 'product')
    mapped_name = ''
    if row.get('status') == 'matched_fallback':
        mapped_name = _row_text(row, 'ruleBookProduct')
    if not product and not mapped_name:
        return

    lookup = names.lookup
    if product and _catalog_display_for(product, lookup):
        return
    if mapped_name and _catalog_display_for(mapped_name, lookup):
        return

    opening_qty = _coerce_measure(
        row.get('sumOfQuantity') if row.get('sumOfQuantity') is not None else row.get('openingQty')
    )
    if opening_qty is None or opening_qty == 0:
        return

    display = mapped_name or product
    loc = _opening_only_location(
        display, row, location_index=location_index, rule_book=rule_book
    )
    if loc is None and display != product and product:
        loc = _opening_only_location(
            product, row, location_index=location_index, rule_book=rule_book
        )
    if loc is None:
        unplaced.append(
            {
                'product': display,
                'source': 'Opening',
                'sumOfQuantity': _coerce_measure(
                    row.get('sumOfQuantity')
                    if row.get('sumOfQuantity') is not None
                    else row.get('openingQty')
                ),
                'sumOfGross': _coerce_measure(
                    row.get('sumOfGross') if row.get('sumOfGross') is not None else row.get('openingAmt')
                ),
            }
        )
        return
    _append_unique_catalog_product(entries, product=display, location=loc)
    names.add(display)


def _append_unique_catalog_product(
    entries: list[tuple[str, str, str | None]],
    *,
    product: str,
    location: tuple[str, str | None],
) -> None:
    category, subcategory = location
    entries.append((product, category, subcategory))


def _build_financials_product_catalog(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None,
    opening_pivot: Sequence[Mapping[str, Any]] | None,
    location_index: Mapping[str, tuple[str, str | None]],
    rule_book: Mapping[str, Any],
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
) -> tuple[list[tuple[str, str, str | None]], list[dict[str, Any]]]:
    """
    Sales + Purchases (deduped), then Opening Quantity products absent from that list,
    then MR/DC products absent from Sales, Purchases, and Opening Quantity.

    Opening-only products with a zero or blank Opening Balance are omitted.
    """
    entries: list[tuple[str, str, str | None]] = []
    unplaced: list[dict[str, Any]] = []
    names = _IncrementalProductLookup()

    def _try_add_from_row(
        row: Mapping[str, Any],
        *,
        source: str,
        locate,
    ) -> None:
        product = _row_text(row, 'product')
        if not product:
            return
        existing = _resolve_rule_book_display_name(product, lookup=names.lookup)
        if existing is not None:
            return
        loc = locate(product, row)
        if loc is None:
            unplaced.append(
                {
                    'product': product,
                    'source': source,
                    'sumOfQuantity': _coerce_measure(
                        row.get('sumOfQuantity') if row.get('sumOfQuantity') is not None else row.get('openingQty')
                    ),
                    'sumOfGross': _coerce_measure(
                        row.get('sumOfGross') if row.get('sumOfGross') is not None else row.get('openingAmt')
                    ),
                }
            )
            return
        _append_unique_catalog_product(entries, product=product, location=loc)
        names.add(product)

    for row in sales_pivot or ():
        _try_add_from_row(
            row,
            source='Sales',
            locate=lambda product, row: _sales_purchases_location(
                product, row, location_index=location_index, rule_book=rule_book
            ),
        )
    for row in purchases_pivot or ():
        _try_add_from_row(
            row,
            source='Purchases',
            locate=lambda product, row: _sales_purchases_location(
                product, row, location_index=location_index, rule_book=rule_book
            ),
        )
    for row in opening_pivot or ():
        _try_add_opening_row(
            row,
            entries=entries,
            unplaced=unplaced,
            location_index=location_index,
            rule_book=rule_book,
            names=names,
        )
    for source, row in iter_mr_dc_rows(mr_pivots, dc_pivots):
        _try_add_from_row(
            row,
            source=source,
            locate=lambda product, row: _code_sheet_location(product),
        )
    return entries, unplaced


def _aggregate_pivot_by_rule_book(
    rows: Sequence[Mapping[str, Any]] | None,
    *,
    lookup: Mapping[str, str],
) -> tuple[dict[str, dict[str, float | None]], list[dict[str, Any]]]:
    """Claim each pivot row once and SUM onto the matching Rule Book display name."""
    by_display: dict[str, dict[str, float | None]] = {}
    unmapped_rows: list[dict[str, Any]] = []

    for row in rows or ():
        product_name = str(row.get('product') or '').strip()
        if not product_name:
            continue
        qty = _coerce_measure(row.get('sumOfQuantity'))
        gross = _coerce_measure(row.get('sumOfGross'))
        display_name = _resolve_rule_book_display_name(product_name, lookup=lookup)
        if display_name is None:
            unmapped_rows.append(
                {
                    'product': product_name,
                    'sumOfQuantity': qty,
                    'sumOfGross': gross,
                }
            )
            continue
        entry = by_display.setdefault(display_name, _empty_measures())
        _accumulate_measures(entry, qty=qty, gross=gross)

    return by_display, unmapped_rows


_RECEIPT_QTY_KEYS: tuple[str, ...] = (
    'receiptsInternalQty',
    'receiptsJubileeHillsQty',
    'receiptsKokapetQty',
)


def _sum_qty_parts(raw: Mapping[str, float | None], keys: Sequence[str]) -> float | None:
    parts = [_coerce_measure(raw.get(key)) for key in keys]
    if all(part is None for part in parts):
        return None
    return float(sum(Decimal(str(part or 0)) for part in parts))


def _add_stock_section_totals(raw: dict[str, float | None]) -> dict[str, float | None]:
    """
    Total Qty/Amt = Opening + Purchases + Receipts Total.

    Receipts Total Qty = Internal + Jubilee Hills + Kokapet when those columns
    have values. Missing components count as 0.
    """
    receipts_from_branches = _sum_qty_parts(raw, _RECEIPT_QTY_KEYS)
    if receipts_from_branches is not None:
        raw['receiptsQty'] = receipts_from_branches

    opening_qty = _coerce_measure(raw.get('openingQty'))
    purchases_qty = _coerce_measure(raw.get('purchasesQty'))
    receipts_qty = _coerce_measure(raw.get('receiptsQty'))
    opening_amt = _coerce_measure(raw.get('openingAmt'))
    purchases_amt = _coerce_measure(raw.get('purchasesAmt'))
    receipts_amt = _coerce_measure(raw.get('receiptsAmt'))

    if all(value is None for value in (opening_qty, purchases_qty, receipts_qty)):
        raw['totalQty'] = None
    else:
        raw['totalQty'] = float(
            Decimal(str(opening_qty or 0))
            + Decimal(str(purchases_qty or 0))
            + Decimal(str(receipts_qty or 0))
        )

    if all(value is None for value in (opening_amt, purchases_amt, receipts_amt)):
        raw['totalAmt'] = None
    else:
        raw['totalAmt'] = float(
            Decimal(str(opening_amt or 0))
            + Decimal(str(purchases_amt or 0))
            + Decimal(str(receipts_amt or 0))
        )
    return _add_gross_profit_pct(
        _add_gross_profit(_add_closing_stock(_add_issues_amounts(_add_average_rate(raw))))
    )


def _add_average_rate(raw: dict[str, float | None]) -> dict[str, float | None]:
    """Average Rate Amount = Total Amount / Total Qty. Qty 0 → 0. Does not change Totals."""
    total_qty = _coerce_measure(raw.get('totalQty'))
    total_amt = _coerce_measure(raw.get('totalAmt'))
    if total_qty is None and total_amt is None:
        raw['averageRateAmt'] = None
        return raw
    if total_qty is None or total_qty == 0:
        raw['averageRateAmt'] = 0.0
        return raw
    raw['averageRateAmt'] = float(
        (Decimal(str(total_amt or 0)) / Decimal(str(total_qty))).quantize(
            Decimal('0.0001'),
            rounding=ROUND_HALF_UP,
        )
    )
    return raw


_ISSUE_AMT_BY_QTY: tuple[tuple[str, str], ...] = (
    ('issuesInternalQty', 'issuesInternalAmt'),
    ('issuesBanjaraHillsQty', 'issuesBanjaraHillsAmt'),
    ('issuesKokapetQty', 'issuesKokapetAmt'),
)


def _add_issues_amounts(raw: dict[str, float | None]) -> dict[str, float | None]:
    """Issue Amount = Issue Qty × Average Rate. Qty 0 → 0. Does not change Issue Qty."""
    rate = _coerce_measure(raw.get('averageRateAmt'))
    for qty_key, amt_key in _ISSUE_AMT_BY_QTY:
        qty = _coerce_measure(raw.get(qty_key))
        if qty is None:
            raw[amt_key] = None
            continue
        if qty == 0:
            raw[amt_key] = 0.0
            continue
        raw[amt_key] = float(Decimal(str(qty)) * Decimal(str(rate or 0)))
    issues_total_amt = _sum_qty_parts(raw, _ISSUE_AMT_KEYS)
    raw['issuesTotalAmt'] = issues_total_amt
    return raw


_ISSUE_QTY_KEYS: tuple[str, ...] = (
    'issuesInternalQty',
    'issuesBanjaraHillsQty',
    'issuesKokapetQty',
)


def _issues_total_qty(raw: Mapping[str, float | None]) -> float | None:
    """Issues Total Qty = Internal + Banjara Hills + Kokapet."""
    return _sum_qty_parts(raw, _ISSUE_QTY_KEYS)


def _add_closing_stock(raw: dict[str, float | None]) -> dict[str, float | None]:
    """Closing Stock Qty = Total Qty − Sales Qty − Issues Total Qty; Amt = Qty × Average Rate."""
    total_qty = _coerce_measure(raw.get('totalQty'))
    sales_qty = _coerce_measure(raw.get('salesQty'))
    issues_total_qty = _issues_total_qty(raw)
    raw['issuesTotalQty'] = issues_total_qty
    if total_qty is None and sales_qty is None and issues_total_qty is None:
        raw['closingStockQty'] = None
        raw['closingStockAmt'] = None
        return raw
    qty = float(
        Decimal(str(total_qty or 0))
        - Decimal(str(sales_qty or 0))
        - Decimal(str(issues_total_qty or 0))
    )
    raw['closingStockQty'] = qty
    rate = _coerce_measure(raw.get('averageRateAmt'))
    raw['closingStockAmt'] = float(Decimal(str(qty)) * Decimal(str(rate or 0)))
    return raw


_ISSUE_AMT_KEYS: tuple[str, ...] = (
    'issuesInternalAmt',
    'issuesBanjaraHillsAmt',
    'issuesKokapetAmt',
)


def _issues_total_amt(raw: Mapping[str, float | None]) -> float | None:
    """Issues Total Amount = Internal + Banjara Hills + Kokapet."""
    return _sum_qty_parts(raw, _ISSUE_AMT_KEYS)


def _add_gross_profit(raw: dict[str, float | None]) -> dict[str, float | None]:
    """Gross Profit Amt = Closing Stock Amt + Sales Amt + Issues Total Amt − Total Amt."""
    closing_amt = _coerce_measure(raw.get('closingStockAmt'))
    sales_amt = _coerce_measure(raw.get('salesAmt'))
    issues_total_amt = _issues_total_amt(raw)
    total_amt = _coerce_measure(raw.get('totalAmt'))
    if (
        closing_amt is None
        and sales_amt is None
        and issues_total_amt is None
        and total_amt is None
    ):
        raw['grossProfitAmt'] = None
        return raw
    raw['grossProfitAmt'] = float(
        Decimal(str(closing_amt or 0))
        + Decimal(str(sales_amt or 0))
        + Decimal(str(issues_total_amt or 0))
        - Decimal(str(total_amt or 0))
    )
    return raw


def _add_gross_profit_pct(raw: dict[str, float | None]) -> dict[str, float | None]:
    """Gross Profit % = GP Amt / Sales Amt when GP Amt > 0; else 0. Does not change GP Amt."""
    gp_amt = _coerce_measure(raw.get('grossProfitAmt'))
    if gp_amt is None:
        raw['grossProfitPct'] = None
        return raw
    sales_amt = _coerce_measure(raw.get('salesAmt'))
    if gp_amt > 0 and sales_amt is not None and sales_amt != 0:
        raw['grossProfitPct'] = float(
            (Decimal(str(gp_amt)) / Decimal(str(sales_amt))).quantize(
                Decimal('0.0001'),
                rounding=ROUND_HALF_UP,
            )
        )
        return raw
    raw['grossProfitPct'] = 0.0
    return raw


def _raw_product_measures(
    rule_book_product: str,
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]] | None = None,
    transfer_qty_by_display: Mapping[str, Mapping[str, float]] | None = None,
) -> dict[str, float | None]:
    """Original (unrounded) pivot measures for one Rule Book product."""
    sales = sales_by_display.get(rule_book_product, {})
    purchases = purchases_by_display.get(rule_book_product, {})
    opening = (opening_by_display or {}).get(rule_book_product, {})
    transfer = (transfer_qty_by_display or {}).get(rule_book_product, {})
    raw = {
        'openingQty': opening.get('sumOfQuantity'),
        'openingAmt': opening.get('sumOfGross'),
        'purchasesQty': purchases.get('sumOfQuantity'),
        'purchasesAmt': purchases.get('sumOfGross'),
        'salesQty': sales.get('sumOfQuantity'),
        'salesAmt': sales.get('sumOfGross'),
        'receiptsInternalQty': transfer.get('receiptsInternalQty'),
        'receiptsJubileeHillsQty': transfer.get('receiptsJubileeHillsQty'),
        'receiptsKokapetQty': transfer.get('receiptsKokapetQty'),
        'receiptsQty': None,
        'receiptsAmt': None,
        'issuesInternalQty': transfer.get('issuesInternalQty'),
        'issuesBanjaraHillsQty': transfer.get('issuesBanjaraHillsQty'),
        'issuesKokapetQty': transfer.get('issuesKokapetQty'),
    }
    return _add_stock_section_totals(raw)


def _display_product_measures(raw: Mapping[str, float | None]) -> dict[str, float | None]:
    """Product-level display: round Amounts only; Quantity stays exact."""
    display = {
        key: (
            _round_closing_stock_measure(raw.get(key))
            if key.endswith('Amt')
            else raw.get(key)
        )
        for key in _MEASURE_KEYS
    }
    display['averageRateAmt'] = raw.get('averageRateAmt')
    display['grossProfitPct'] = raw.get('grossProfitPct')
    return display


_MEASURE_KEYS = (
    'openingQty',
    'openingAmt',
    'purchasesQty',
    'purchasesAmt',
    'salesQty',
    'salesAmt',
    'receiptsInternalQty',
    'receiptsInternalAmt',
    'receiptsJubileeHillsQty',
    'receiptsJubileeHillsAmt',
    'receiptsKokapetQty',
    'receiptsKokapetAmt',
    'receiptsQty',
    'receiptsAmt',
    'totalQty',
    'totalAmt',
    'issuesInternalQty',
    'issuesInternalAmt',
    'issuesBanjaraHillsQty',
    'issuesBanjaraHillsAmt',
    'issuesKokapetQty',
    'issuesKokapetAmt',
    'issuesTotalQty',
    'issuesTotalAmt',
    'closingStockQty',
    'closingStockAmt',
    'grossProfitAmt',
)


def _total_measures_from_raw(
    raw_rows: Sequence[Mapping[str, float | None]],
) -> dict[str, float | None]:
    """
    TOTAL / GRAND TOTAL: each column is SUM of product rows in that group.

    Amounts: ROUND(SUM(unrounded)) — never sum of already-rounded product cells.
    Quantity: SUM(unrounded) with no rounding.
    Average Rate stays Total Amt / Total Qty (not a sum of rates).
    """
    totals: dict[str, float] = {}
    present: set[str] = set()
    for raw in raw_rows:
        for key in _MEASURE_KEYS:
            value = _coerce_measure(raw.get(key))
            if value is None:
                continue
            totals[key] = totals.get(key, 0.0) + value
            present.add(key)

    def _finalize(key: str) -> float | None:
        if key not in present:
            return None
        if key.endswith('Amt'):
            return _round_closing_stock_measure(totals[key])
        return totals[key]

    return _add_gross_profit_pct(_add_average_rate({key: _finalize(key) for key in _MEASURE_KEYS}))


def _product_measures_from_maps(
    rule_book_product: str,
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]] | None = None,
    transfer_qty_by_display: Mapping[str, Mapping[str, float]] | None = None,
) -> dict[str, float | None]:
    raw = _raw_product_measures(
        rule_book_product,
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        opening_by_display=opening_by_display,
        transfer_qty_by_display=transfer_qty_by_display,
    )
    return _display_product_measures(raw)


def _product_name_sort_key(name: str) -> tuple:
    """Case-insensitive natural order: RA 2, RA 10, RA 100."""
    parts = re.split(r'(\d+)', str(name or '').casefold())
    key: list[tuple[int, int | str]] = []
    for part in parts:
        if not part:
            continue
        if part.isdigit():
            key.append((0, int(part)))
        else:
            key.append((1, part))
    return tuple(key)


def _sorted_product_names(names: Sequence[str]) -> list[str]:
    return sorted((str(name) for name in names if str(name or '').strip()), key=_product_name_sort_key)


def _subcategory_section_sort_key(category: str, subcategory: str) -> tuple:
    """Diamond and Precious sections use the same order as Jubilee Hills."""
    from app.engines.financials_engine.engine.jubilee_hills_placement import (
        DIAMOND_SHEET,
        DIAMOND_SUBCATEGORY_ORDER,
        PRECIOUS_SHEET,
        PRECIOUS_SUBCATEGORY_ORDER,
    )

    order = {
        DIAMOND_SHEET: DIAMOND_SUBCATEGORY_ORDER,
        PRECIOUS_SHEET: PRECIOUS_SUBCATEGORY_ORDER,
    }.get(category)
    if order and subcategory in order:
        return (0, order.index(subcategory))
    return (1, _product_name_sort_key(subcategory))


def _build_layout_for_category(
    category: str,
    *,
    rule_section: Any,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    opening_by_display: Mapping[str, dict[str, float | None]] | None = None,
    transfer_qty_by_display: Mapping[str, Mapping[str, float]] | None = None,
) -> tuple[list[dict[str, Any]], list[str]]:
    """
    Build one category sheet from the Sales, Purchases, and Opening catalog.

    Rule Book names that are not in those files are not listed.
    Product Amounts are rounded for display; TOTAL Amounts use ROUND(SUM(unrounded)).
    """
    layout: list[dict[str, Any]] = []
    flat_products: list[str] = []
    sheet_raw: list[dict[str, float | None]] = []
    opening_map = opening_by_display or {}
    transfer_map = transfer_qty_by_display or {}

    def _append_product(product: str, subcategory: str | None) -> None:
        raw = _raw_product_measures(
            product,
            sales_by_display=sales_by_display,
            purchases_by_display=purchases_by_display,
            opening_by_display=opening_map,
            transfer_qty_by_display=transfer_map,
        )
        display = _display_product_measures(raw)
        layout.append(
            {
                'kind': 'product',
                'label': product,
                'subcategory': subcategory,
                **display,
            }
        )
        flat_products.append(product)
        sheet_raw.append(raw)

    if isinstance(rule_section, dict):
        sections = sorted(
            rule_section.items(),
            key=lambda pair: _subcategory_section_sort_key(category, str(pair[0] or '')),
        )
        for subcategory, rule_products in sections:
            products = _sorted_product_names(list(rule_products or []))
            if not products:
                continue
            if str(subcategory or '').strip():
                layout.append(
                    {
                        'kind': 'subcategory',
                        'label': subcategory,
                        'subcategory': subcategory,
                    }
                )
            subcategory_raw: list[dict[str, float | None]] = []
            for product in products:
                raw = _raw_product_measures(
                    product,
                    sales_by_display=sales_by_display,
                    purchases_by_display=purchases_by_display,
                    opening_by_display=opening_map,
                    transfer_qty_by_display=transfer_map,
                )
                display = _display_product_measures(raw)
                layout.append(
                    {
                        'kind': 'product',
                        'label': product,
                        'subcategory': subcategory,
                        **display,
                    }
                )
                flat_products.append(product)
                subcategory_raw.append(raw)
                sheet_raw.append(raw)
            layout.append(
                {
                    'kind': 'subcategory_total',
                    'label': subcategory_total_label(category, subcategory),
                    'subcategory': subcategory,
                    **_total_measures_from_raw(subcategory_raw),
                }
            )
    elif isinstance(rule_section, list):
        for product in _sorted_product_names(list(rule_section)):
            _append_product(product, None)

    if flat_products:
        layout.append(
            {
                'kind': 'grand_total',
                'label': 'GRAND TOTAL',
                'subcategory': None,
                **_total_measures_from_raw(sheet_raw),
            }
        )
    return layout, flat_products


def _build_category_pivot_lists(
    *,
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    location_index: Mapping[str, tuple[str, str | None]],
) -> tuple[dict[str, list[dict[str, Any]]], dict[str, list[dict[str, Any]]]]:
    sales_by_category: dict[str, list[dict[str, Any]]] = {c: [] for c in CLOSING_STOCK_CATEGORIES}
    purchases_by_category: dict[str, list[dict[str, Any]]] = {
        c: [] for c in CLOSING_STOCK_CATEGORIES
    }

    def _fill(
        by_display: Mapping[str, dict[str, float | None]],
        target: dict[str, list[dict[str, Any]]],
    ) -> None:
        for display_name, measures in by_display.items():
            loc = resolve_product_location(display_name, index=location_index)
            if loc is None:
                continue
            category, subcategory = loc
            target[category].append(
                {
                    'product': display_name,
                    'sumOfQuantity': measures.get('sumOfQuantity'),
                    'sumOfGross': measures.get('sumOfGross'),
                    'subcategory': subcategory,
                }
            )

    _fill(sales_by_display, sales_by_category)
    _fill(purchases_by_display, purchases_by_category)
    return sales_by_category, purchases_by_category


def _count_products_with_measures(
    products_by_category: Mapping[str, Sequence[str]],
    by_display: Mapping[str, dict[str, float | None]],
) -> int:
    count = 0
    seen: set[str] = set()
    for products in products_by_category.values():
        for product in products:
            key = _norm_product(product)
            if not key or key in seen:
                continue
            seen.add(key)
            entry = by_display.get(product, {})
            if entry.get('sumOfQuantity') is not None or entry.get('sumOfGross') is not None:
                count += 1
    return count


def _sum_measure_map(
    by_display: Mapping[str, dict[str, float | None]],
    *,
    round_for_closing_stock: bool = False,
) -> tuple[float, float]:
    qty_total = 0.0
    amt_total = 0.0
    for entry in by_display.values():
        qty = _coerce_measure(entry.get('sumOfQuantity'))
        gross = _coerce_measure(entry.get('sumOfGross'))
        if round_for_closing_stock:
            # Amounts are rounded for product display; quantities stay exact.
            gross = _round_closing_stock_measure(gross)
        if qty is not None:
            qty_total += qty
        if gross is not None:
            amt_total += gross
    return round(qty_total, 4), round(amt_total, 4)


def _sum_pivot_rows(
    rows: Sequence[Mapping[str, Any]] | None,
) -> tuple[float, float]:
    qty_total = 0.0
    amt_total = 0.0
    for row in rows or ():
        qty = _coerce_measure(row.get('sumOfQuantity'))
        gross = _coerce_measure(row.get('sumOfGross'))
        if qty is not None:
            qty_total += qty
        if gross is not None:
            amt_total += gross
    return round(qty_total, 4), round(amt_total, 4)


def _sum_output_measures(
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]],
) -> tuple[float, float, float, float]:
    sales_qty = 0.0
    sales_amt = 0.0
    purchases_qty = 0.0
    purchases_amt = 0.0
    for layout in layout_by_category.values():
        for row in layout:
            if row.get('kind') != 'product':
                continue
            sq = _coerce_measure(row.get('salesQty'))
            sa = _coerce_measure(row.get('salesAmt'))
            pq = _coerce_measure(row.get('purchasesQty'))
            pa = _coerce_measure(row.get('purchasesAmt'))
            if sq is not None:
                sales_qty += sq
            if sa is not None:
                sales_amt += sa
            if pq is not None:
                purchases_qty += pq
            if pa is not None:
                purchases_amt += pa
    return (
        round(sales_qty, 4),
        round(sales_amt, 4),
        round(purchases_qty, 4),
        round(purchases_amt, 4),
    )


def _build_reconciliation(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None,
    layout_by_category: Mapping[str, Sequence[Mapping[str, Any]]],
    sales_by_display: Mapping[str, dict[str, float | None]],
    purchases_by_display: Mapping[str, dict[str, float | None]],
    unmapped_sales: Sequence[Mapping[str, Any]],
    unmapped_purchases: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    pivot_sales_qty, pivot_sales_amt = _sum_pivot_rows(sales_pivot)
    pivot_purchases_qty, pivot_purchases_amt = _sum_pivot_rows(purchases_pivot)
    # Unrounded mapped totals (match pivot math before Closing Stock rounding).
    mapped_sales_qty, mapped_sales_amt = _sum_measure_map(sales_by_display)
    mapped_purchases_qty, mapped_purchases_amt = _sum_measure_map(purchases_by_display)
    # Rounded per-product totals must match Closing Stock layout output.
    rounded_sales_qty, rounded_sales_amt = _sum_measure_map(
        sales_by_display, round_for_closing_stock=True
    )
    rounded_purchases_qty, rounded_purchases_amt = _sum_measure_map(
        purchases_by_display, round_for_closing_stock=True
    )
    unmapped_sales_qty, unmapped_sales_amt = _sum_pivot_rows(unmapped_sales)
    unmapped_purchases_qty, unmapped_purchases_amt = _sum_pivot_rows(unmapped_purchases)
    out_sales_qty, out_sales_amt, out_purchases_qty, out_purchases_amt = _sum_output_measures(
        layout_by_category
    )

    def _eq(a: float, b: float) -> bool:
        return abs(a - b) <= 1e-4

    mapped_matches_output = (
        _eq(rounded_sales_qty, out_sales_qty)
        and _eq(rounded_sales_amt, out_sales_amt)
        and _eq(rounded_purchases_qty, out_purchases_qty)
        and _eq(rounded_purchases_amt, out_purchases_amt)
    )
    pivot_matches_output = (
        _eq(pivot_sales_qty, out_sales_qty)
        and _eq(pivot_sales_amt, out_sales_amt)
        and _eq(pivot_purchases_qty, out_purchases_qty)
        and _eq(pivot_purchases_amt, out_purchases_amt)
    )
    pivot_split_match = (
        _eq(mapped_sales_qty + unmapped_sales_qty, pivot_sales_qty)
        and _eq(mapped_sales_amt + unmapped_sales_amt, pivot_sales_amt)
        and _eq(mapped_purchases_qty + unmapped_purchases_qty, pivot_purchases_qty)
        and _eq(mapped_purchases_amt + unmapped_purchases_amt, pivot_purchases_amt)
    )

    return {
        'salesPivotQty': pivot_sales_qty,
        'salesPivotAmt': pivot_sales_amt,
        'purchasesPivotQty': pivot_purchases_qty,
        'purchasesPivotAmt': pivot_purchases_amt,
        'mappedSalesQty': mapped_sales_qty,
        'mappedSalesAmt': mapped_sales_amt,
        'mappedPurchasesQty': mapped_purchases_qty,
        'mappedPurchasesAmt': mapped_purchases_amt,
        'unmappedSalesQty': unmapped_sales_qty,
        'unmappedSalesAmt': unmapped_sales_amt,
        'unmappedPurchasesQty': unmapped_purchases_qty,
        'unmappedPurchasesAmt': unmapped_purchases_amt,
        'outputSalesQty': out_sales_qty,
        'outputSalesAmt': out_sales_amt,
        'outputPurchasesQty': out_purchases_qty,
        'outputPurchasesAmt': out_purchases_amt,
        'salesQtyMatch': _eq(pivot_sales_qty, out_sales_qty),
        'salesAmtMatch': _eq(pivot_sales_amt, out_sales_amt),
        'purchasesQtyMatch': _eq(pivot_purchases_qty, out_purchases_qty),
        'purchasesAmtMatch': _eq(pivot_purchases_amt, out_purchases_amt),
        'mappedOutputMatch': mapped_matches_output,
        'pivotOutputMatch': pivot_matches_output,
        'pivotSplitMatch': pivot_split_match,
        'unmappedProductCount': len(unmapped_sales) + len(unmapped_purchases),
    }


def map_pivots_to_closing_stock_categories(
    *,
    sales_pivot: Sequence[Mapping[str, Any]] | None = None,
    purchases_pivot: Sequence[Mapping[str, Any]] | None = None,
    opening_pivot: Sequence[Mapping[str, Any]] | None = None,
    mr_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    dc_pivots: Mapping[str, Sequence[Mapping[str, Any]]] | None = None,
    rule_book: Mapping[str, Any] | None = None,
    destination_branch: str | None = None,
    source_average_rates: Any = None,
) -> dict[str, Any]:
    """
    Build Closing Stock rows from Sales + Purchases, then Opening Quantity-only products.

    Sheet placement matches Jubilee Hills: Diamond regex, JOS/JSP/JSY, then JEM/JPS/JRU.
    The Rule Book does not choose the sheet. Opening-only products without those codes
    use the previous-year sheet, except Diamond. Display names come from the files.
    """
    log = get_logger('closing-stock-rule-book')
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    rule_book_fingerprint = compute_rule_book_fingerprint(book)
    location_index = build_product_location_index(book)
    rule_counts = count_rule_book_products(book)
    total_rule_products = sum(rule_counts.values())

    log.info(
        'Rule Book loaded from disk: path={} mtime={} total_products={} fingerprint={}',
        str(_RULE_BOOK_PATH),
        _RULE_BOOK_PATH.stat().st_mtime if _RULE_BOOK_PATH.exists() else None,
        total_rule_products,
        rule_book_fingerprint[:12],
    )
    for category in CLOSING_STOCK_CATEGORIES:
        log.info('Rule Book products — {}: {}', category, rule_counts.get(category, 0))

    catalog_entries, _unplaced_catalog = _build_financials_product_catalog(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_pivot,
        location_index=location_index,
        rule_book=book,
        mr_pivots=mr_pivots,
        dc_pivots=dc_pivots,
    )
    layout_book = _catalog_to_rule_book(catalog_entries)
    match_lookup = _build_rule_book_match_lookup(layout_book)

    sales_by_display, unmapped_sales_rows = _aggregate_pivot_by_rule_book(
        sales_pivot,
        lookup=match_lookup,
    )
    purchases_by_display, unmapped_purchases_rows = _aggregate_pivot_by_rule_book(
        purchases_pivot,
        lookup=match_lookup,
    )
    layout_product_names = [display for _cat, _sub, display in _iter_rule_book_products(layout_book)]
    opening_by_display, unmapped_opening_rows = build_opening_measures_for_layout(
        opening_pivot,
        layout_product_names,
    )
    opening_by_display, unmapped_opening_rows = apply_fallback_opening_to_layout(
        opening_by_display,
        opening_pivot,
        rule_book=layout_book,
        unmapped_rows=unmapped_opening_rows,
    )
    unmapped_opening_rows = [
        row for row in unmapped_opening_rows if not _opening_balance_blank_or_zero(row)
    ]

    from app.engines.financials_engine.engine.mr_dc_closing_qty import map_mr_dc_qty_to_rule_book

    transfer_qty_by_display = map_mr_dc_qty_to_rule_book(
        mr_pivots=mr_pivots,
        dc_pivots=dc_pivots,
        rule_book=layout_book,
    )

    unmapped: list[str] = []
    unmapped_details: list[dict[str, str]] = []
    unmapped_seen: set[str] = set()
    unmapped_counts: dict[str, int] = {}
    for source, rows in (
        ('Sales', unmapped_sales_rows),
        ('Purchases', unmapped_purchases_rows),
        ('Opening', unmapped_opening_rows),
    ):
        for row in rows:
            product_name = str(row.get('product') or '')
            key = _norm_product(product_name)
            if not key or key in unmapped_seen:
                continue
            if _trading_account_product(product_name):
                continue
            unmapped_seen.add(key)
            unmapped.append(product_name)
            unmapped_details.append({'product': product_name, 'source': source})
            unmapped_counts[source] = unmapped_counts.get(source, 0) + 1

    for source, row in iter_mr_dc_rows(mr_pivots, dc_pivots):
        product_name = str(row.get('product') or '').strip()
        key = _norm_product(product_name)
        if not key or key in unmapped_seen:
            continue
        if _resolve_rule_book_display_name(product_name, lookup=match_lookup):
            continue
        if _trading_account_product(product_name):
            continue
        unmapped_seen.add(key)
        unmapped.append(product_name)
        unmapped_details.append({'product': product_name, 'source': source})
        unmapped_counts[source] = unmapped_counts.get(source, 0) + 1
    if unmapped_counts:
        log.warning(
            'Unmapped pivot products: {}',
            ', '.join(f'{source}={count}' for source, count in unmapped_counts.items()),
        )

    layout_location_index = build_product_location_index(layout_book)
    sales_by_category, purchases_by_category = _build_category_pivot_lists(
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        location_index=layout_location_index,
    )

    products_by_category: dict[str, list[str]] = {}
    layout_by_category: dict[str, list[dict[str, Any]]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        layout, flat = _build_layout_for_category(
            category,
            rule_section=layout_book.get(category),
            sales_by_display=sales_by_display,
            purchases_by_display=purchases_by_display,
            opening_by_display=opening_by_display,
            transfer_qty_by_display=transfer_qty_by_display,
        )
        layout_by_category[category] = layout
        products_by_category[category] = flat

    mapped_count = sum(len(v) for v in products_by_category.values())
    products_with_sales = _count_products_with_measures(products_by_category, sales_by_display)
    products_with_purchases = _count_products_with_measures(
        products_by_category,
        purchases_by_display,
    )
    products_with_opening = _count_products_with_measures(
        products_by_category,
        opening_by_display,
    )

    mapped_opening_products = [
        {
            'product': name,
            'openingQty': measures.get('sumOfQuantity'),
            'openingAmt': measures.get('sumOfGross'),
        }
        for name, measures in opening_by_display.items()
    ]

    log.info(
        'Closing Stock fill — catalog={} displayed={} with_sales={} with_purchases={} '
        'with_opening={} pivot_unmapped={}',
        len(catalog_entries),
        mapped_count,
        products_with_sales,
        products_with_purchases,
        products_with_opening,
        len(unmapped),
    )

    reconciliation = _build_reconciliation(
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        layout_by_category=layout_by_category,
        sales_by_display=sales_by_display,
        purchases_by_display=purchases_by_display,
        unmapped_sales=unmapped_sales_rows,
        unmapped_purchases=unmapped_purchases_rows,
    )

    log.info(
        'Reconciliation — sales pivot={} mapped={} output={} | '
        'purchases pivot={} mapped={} output={} | mapped_ok={} split_ok={} unmapped={}',
        reconciliation['salesPivotQty'],
        reconciliation['mappedSalesQty'],
        reconciliation['outputSalesQty'],
        reconciliation['purchasesPivotQty'],
        reconciliation['mappedPurchasesQty'],
        reconciliation['outputPurchasesQty'],
        reconciliation['mappedOutputMatch'],
        reconciliation['pivotSplitMatch'],
        len(unmapped),
    )
    if not reconciliation['mappedOutputMatch']:
        log.error('Mapped pivot totals do not match Closing Stock output totals')
    if not reconciliation['pivotOutputMatch']:
        log.warning(
            'Full pivot totals differ from output due to unmapped products '
            '(sales_qty={} sales_amt={} purchases_qty={} purchases_amt={})',
            reconciliation['unmappedSalesQty'],
            reconciliation['unmappedSalesAmt'],
            reconciliation['unmappedPurchasesQty'],
            reconciliation['unmappedPurchasesAmt'],
        )

    return _apply_branch_receipt_amounts(
        {
        'productsByCategory': products_by_category,
        'layoutByCategory': layout_by_category,
        'salesByCategory': sales_by_category,
        'purchasesByCategory': purchases_by_category,
        'unmappedProducts': unmapped,
        'unmappedProductDetails': unmapped_details,
        'unmappedOpeningProducts': [
            str(r.get('product') or '') for r in unmapped_opening_rows if r.get('product')
        ],
        'mappedOpeningProducts': mapped_opening_products,
        'ruleBookProductCounts': rule_counts,
        'ruleBookProductTotal': total_rule_products,
        'ruleBookFingerprint': rule_book_fingerprint,
        'productsWithSalesData': products_with_sales,
        'productsWithPurchaseData': products_with_purchases,
        'productsWithOpeningData': products_with_opening,
        'productsDisplayed': mapped_count,
        'reconciliation': reconciliation,
        'categories': list(CLOSING_STOCK_CATEGORIES),
        'receiptAmountReview': [],
        'productAverageRates': [],
        },
        destination_branch=destination_branch,
        source_average_rates=source_average_rates,
    )


def _apply_branch_receipt_amounts(
    mapped: dict[str, Any],
    *,
    destination_branch: str | None,
    source_average_rates: Any = None,
) -> dict[str, Any]:
    """Fill receipt amounts when the sheet's branch is known. Quantities stay put."""
    if not destination_branch:
        return mapped
    from app.engines.financials_engine.engine.receipt_amounts import (
        apply_source_receipt_amounts,
    )

    applied = apply_source_receipt_amounts(
        mapped.get('layoutByCategory'),
        destination=destination_branch,
        source_average_rates=source_average_rates,
    )
    mapped['layoutByCategory'] = applied['layoutByCategory']
    mapped['receiptAmountReview'] = applied['receiptAmountReview']
    mapped['productAverageRates'] = applied['productAverageRates']
    return mapped


def map_product_names_to_categories(
    products: Sequence[str],
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, list[str]]:
    """Return ALL Rule Book products per category."""
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    result: dict[str, list[str]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        _, flat = _build_layout_for_category(
            category,
            rule_section=book.get(category),
            sales_by_display={},
            purchases_by_display={},
        )
        result[category] = flat
    return result


def map_product_names_to_layouts(
    products: Sequence[str],
    *,
    rule_book: Mapping[str, Any] | None = None,
) -> dict[str, list[dict[str, Any]]]:
    mapped = map_pivots_to_closing_stock_categories(
        sales_pivot=[],
        purchases_pivot=[],
        rule_book=rule_book,
    )
    return mapped['layoutByCategory']

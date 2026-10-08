"""The running product index must match a full rebuild after every added name."""

from app.engines.financials_engine.config.product_rule_book import (
    _IncrementalProductLookup,
    _lookup_from_entries,
)


def test_incremental_lookup_matches_full_rebuild_after_each_product() -> None:
    names = [
        'Di. Beads',
        'Di. Beads 1',
        'Flat polki FP 1',
        'FP 1',
        'Emeralds JEM 100',
        'JEM 100',
        'Synthetic JSY 100',
        'Synthetic SYN 100',
        'Pearls JPS 50',
        'Gold Ornaments',
    ]
    running = _IncrementalProductLookup()
    entries: list[tuple[str, str, str | None]] = []
    for name in names:
        running.add(name)
        entries.append((name, 'Diamond', None))
        assert running.lookup == _lookup_from_entries(entries)

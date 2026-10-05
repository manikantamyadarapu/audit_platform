"""Blank Jubilee Hills Financials workbook — same sheets as Basheerbagh, no values."""

from __future__ import annotations

from io import BytesIO
from typing import Any

from openpyxl import Workbook

from app.engines.financials_engine.config.product_rule_book import (
    load_closing_stock_product_rule_book,
)
from app.engines.financials_engine.engine.abstract_template import (
    ABSTRACT_SHEET_NAME,
    write_abstract_sheet,
)
from app.engines.financials_engine.engine.closing_stock_template import (
    CLOSING_STOCK_CATEGORIES,
    LEAF_COLUMNS,
    _apply_closing_stock_cell_format,
    _write_closing_stock_sheet,
    subcategory_total_label,
)
from app.engines.financials_engine.engine.trading_template import (
    TRADING_SHEET_NAME,
    write_trading_sheet,
)

# Jubilee Hills books name the other branch Basheerbagh on both Receipts and Issues.
JUBILEE_HILLS_LOCATION_LABELS: dict[str, str] = {
    'Jubilee Hills': 'Basheerbagh',
    'Banjara Hills': 'Basheerbagh',
}


def blank_jubilee_hills_layouts(rule_book: dict[str, Any] | None = None) -> dict[str, list[dict[str, str]]]:
    """Category section headers and total placeholders. No product rows and no amounts."""
    book = rule_book if rule_book is not None else load_closing_stock_product_rule_book()
    layouts: dict[str, list[dict[str, str]]] = {}
    for category in CLOSING_STOCK_CATEGORIES:
        rows: list[dict[str, str]] = []
        section = book.get(category)
        if isinstance(section, dict):
            for subcategory in section:
                label = str(subcategory).strip()
                if not label:
                    continue
                rows.append({'kind': 'subcategory', 'label': label, 'subcategory': label})
                rows.append(
                    {
                        'kind': 'subcategory_total',
                        'label': subcategory_total_label(category, label),
                        'subcategory': label,
                    }
                )
        rows.append({'kind': 'grand_total', 'label': 'GRAND TOTAL'})
        layouts[category] = rows
    return layouts


def _format_blank_category_cells(ws) -> None:
    for row in range(10, (ws.max_row or 9) + 1):
        for index, (path, _number) in enumerate(LEAF_COLUMNS):
            cell = ws.cell(row=row, column=2 + index)
            if cell.value is None:
                _apply_closing_stock_cell_format(cell, path)


def build_jubilee_hills_structure_bytes(
    *,
    company_name: str = '',
    address: str = '',
    financial_year: str = 'AY 2025-26',
    rule_book: dict[str, Any] | None = None,
) -> bytes:
    """Same sheet order and formatting as Closing Stock, with every measure left blank."""
    layouts = blank_jubilee_hills_layouts(rule_book)
    wb = Workbook()
    for index, category in enumerate(CLOSING_STOCK_CATEGORIES):
        ws = wb.active if index == 0 else wb.create_sheet()
        ws.title = category[:31]
        _write_closing_stock_sheet(
            ws,
            category=category,
            products=[],
            layout_rows=layouts[category],
            company_name=company_name,
            address=address,
            financial_year=financial_year,
            location_labels=JUBILEE_HILLS_LOCATION_LABELS,
        )
        _format_blank_category_cells(ws)

    trading = wb.create_sheet(title=TRADING_SHEET_NAME)
    write_trading_sheet(trading, structure_only=True)
    abstract = wb.create_sheet(title=ABSTRACT_SHEET_NAME)
    write_abstract_sheet(abstract, structure_only=True)

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def build_jubilee_hills_workbook_bytes(
    *,
    company_name: str = '',
    address: str = '',
    financial_year: str = 'AY 2025-26',
    rule_book: dict[str, Any] | None = None,
    layout_by_category: dict[str, list[dict[str, Any]]] | None = None,
    sales_pivot: list[dict[str, Any]] | None = None,
    purchases_pivot: list[dict[str, Any]] | None = None,
    opening_pivot: list[dict[str, Any]] | None = None,
    mr_pivots: dict[str, list[dict[str, Any]]] | None = None,
    dc_pivots: dict[str, list[dict[str, Any]]] | None = None,
) -> bytes:
    """Blank structure when no layout is supplied. Placed products keep their sheet values."""
    if not layout_by_category:
        return build_jubilee_hills_structure_bytes(
            company_name=company_name,
            address=address,
            financial_year=financial_year,
            rule_book=rule_book,
        )

    wb = Workbook()
    for index, category in enumerate(CLOSING_STOCK_CATEGORIES):
        ws = wb.active if index == 0 else wb.create_sheet()
        ws.title = category[:31]
        _write_closing_stock_sheet(
            ws,
            category=category,
            products=[],
            layout_rows=list(layout_by_category.get(category) or []),
            company_name=company_name,
            address=address,
            financial_year=financial_year,
            location_labels=JUBILEE_HILLS_LOCATION_LABELS,
        )

    trading = wb.create_sheet(title=TRADING_SHEET_NAME)
    write_trading_sheet(
        trading,
        layout_by_category,
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_pivot,
        mr_pivots=mr_pivots,
        dc_pivots=dc_pivots,
    )
    abstract = wb.create_sheet(title=ABSTRACT_SHEET_NAME)
    write_abstract_sheet(
        abstract,
        layout_by_category,
        sales_pivot=sales_pivot,
        purchases_pivot=purchases_pivot,
        opening_pivot=opening_pivot,
        mr_pivots=mr_pivots,
        dc_pivots=dc_pivots,
    )

    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()

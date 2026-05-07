"""Thin facade over shared Excel read utilities (single import path for processors)."""

from app.utils.excel_reader import effective_excel_max_row, tuple_cell_1

__all__ = ['effective_excel_max_row', 'tuple_cell_1']

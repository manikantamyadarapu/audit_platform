"""Shared base classes for audit engines."""

from app.core.base_processor import BaseProcessor

# Canonical name used by the engines layout
BaseEngine = BaseProcessor

__all__ = ['BaseEngine', 'BaseProcessor']

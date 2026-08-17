"""Backward-compatible re-export of the official sales audit engine."""

from app.engines.sales_engine.engine.vectorized_sales_engine import SalesValidationResult, VectorizedSalesEngine

__all__ = ['SalesValidationResult', 'VectorizedSalesEngine']

"""Shared request schemas for process/export endpoints."""

from typing import Any

from pydantic import BaseModel


class InvalidRowsExportRequest(BaseModel):
    records: list[dict[str, Any]]
    summary: dict[str, Any] | None = None
    processingStatistics: dict[str, Any] | None = None
    executionTiming: dict[str, Any] | None = None


class PanInvalidRowsExportRequest(InvalidRowsExportRequest):
    pass


class SalesReturnRateComparisonExportRequest(BaseModel):
    records: list[dict[str, Any]]


class SalesReturnExceptionExportRequest(BaseModel):
    records: list[dict[str, Any]] | None = None
    validationIssues: list[dict[str, Any]] | None = None
    comparisonIssues: list[dict[str, Any]] | None = None
    exportColumns: list[str] | None = None
    columnDisplayHeaders: dict[str, str] | None = None

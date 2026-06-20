"""Central registry and builders for audit issues."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from app.sales_engine.validators.sales_audit_messages import (
    MSG_INVALID_UOM,
    MSG_INVALID_UNIT_RATE_RANGE,
)
from app.utils.constants import (
    ADDRESS_PROOF_MISSING_MESSAGE,
    GROSS_WEIGHT_DIFFERENCE_MESSAGE,
    GROSS_WEIGHT_MISMATCH_MESSAGE,
    INVALID_ADDRESS_MESSAGE,
    INVALID_PAN_FORMAT_MESSAGE,
    NEGATIVE_WEIGHT_MESSAGE,
    NO_PAN_FORM60_AVAILABLE_MESSAGE,
    NO_PAN_INVALID_FORM60_MESSAGE,
    NO_PAN_NO_FORM60_MESSAGE,
    PAN_MISSING_OR_INVALID_MESSAGE,
    SALES_ISSUE_MESSAGES,
    VALID_ADDRESS_FORMAT_MESSAGE,
    VALID_PAN_MESSAGE,
)


class IssueSeverity(str, Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    CRITICAL = 'critical'


class IssueCategory(str, Enum):
    SCHEMA = 'schema'
    COMPLIANCE = 'compliance'
    DATA_QUALITY = 'data_quality'
    RECONCILIATION = 'reconciliation'
    BUSINESS_RULE = 'business_rule'
    REFERENCE_DATA = 'reference_data'


@dataclass(frozen=True, slots=True)
class IssueDefinition:
    issue_code: str
    severity: IssueSeverity
    category: IssueCategory
    default_message: str


@dataclass(frozen=True, slots=True)
class IssueRecord:
    issue_code: str
    severity: str
    category: str
    row_number: int | None
    message: str
    source_processor: str
    detected_at: str
    metadata: dict[str, Any] = field(default_factory=dict)
    audit_trace: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            'issue_code': self.issue_code,
            'severity': self.severity,
            'category': self.category,
            'row_number': self.row_number,
            'message': self.message,
            'source_processor': self.source_processor,
            'detected_at': self.detected_at,
            'metadata': dict(self.metadata),
            'audit_trace': dict(self.audit_trace),
        }


_ISSUE_REGISTRY: dict[str, IssueDefinition] = {
    'MISSING_REQUIRED_COLUMNS': IssueDefinition(
        issue_code='MISSING_REQUIRED_COLUMNS',
        severity=IssueSeverity.CRITICAL,
        category=IssueCategory.SCHEMA,
        default_message='Required columns are missing from the uploaded sheet.',
    ),
    'MISSING_PAN_ABOVE_2L': IssueDefinition(
        issue_code='MISSING_PAN_ABOVE_2L',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message=PAN_MISSING_OR_INVALID_MESSAGE,
    ),
    'VALID_PAN': IssueDefinition(
        issue_code='VALID_PAN',
        severity=IssueSeverity.LOW,
        category=IssueCategory.COMPLIANCE,
        default_message=VALID_PAN_MESSAGE,
    ),
    'INVALID_PAN_FORMAT': IssueDefinition(
        issue_code='INVALID_PAN_FORMAT',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message=INVALID_PAN_FORMAT_MESSAGE,
    ),
    'MISSING_FORM_60': IssueDefinition(
        issue_code='MISSING_FORM_60',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message='PAN is missing/invalid; Form 60 should be provided.',
    ),
    'NO_PAN_NO_FORM60': IssueDefinition(
        issue_code='NO_PAN_NO_FORM60',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message=NO_PAN_NO_FORM60_MESSAGE,
    ),
    'NO_PAN_FORM60_AVAILABLE': IssueDefinition(
        issue_code='NO_PAN_FORM60_AVAILABLE',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message=NO_PAN_FORM60_AVAILABLE_MESSAGE,
    ),
    'NO_PAN_INVALID_FORM60': IssueDefinition(
        issue_code='NO_PAN_INVALID_FORM60',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message=NO_PAN_INVALID_FORM60_MESSAGE,
    ),

    'MISSING_ADDRESS_PROOF_ABOVE_50K': IssueDefinition(
        issue_code='MISSING_ADDRESS_PROOF_ABOVE_50K',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message=ADDRESS_PROOF_MISSING_MESSAGE,
    ),
    'INVALID_ADDRESS': IssueDefinition(
        issue_code='INVALID_ADDRESS',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.COMPLIANCE,
        default_message=INVALID_ADDRESS_MESSAGE,
    ),
    'VALID_ADDRESS_FORMAT': IssueDefinition(
        issue_code='VALID_ADDRESS_FORMAT',
        severity=IssueSeverity.LOW,
        category=IssueCategory.COMPLIANCE,
        default_message=VALID_ADDRESS_FORMAT_MESSAGE,
    ),
    'NEGATIVE_WEIGHT_VALUES': IssueDefinition(
        issue_code='NEGATIVE_WEIGHT_VALUES',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.DATA_QUALITY,
        default_message=NEGATIVE_WEIGHT_MESSAGE,
    ),
    'GROSS_WEIGHT_MISMATCH': IssueDefinition(
        issue_code='GROSS_WEIGHT_MISMATCH',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.RECONCILIATION,
        default_message=GROSS_WEIGHT_MISMATCH_MESSAGE,
    ),
    'GROSS_WEIGHT_DIFFERENCE_VIOLATION': IssueDefinition(
        issue_code='GROSS_WEIGHT_DIFFERENCE_VIOLATION',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.RECONCILIATION,
        default_message=GROSS_WEIGHT_DIFFERENCE_MESSAGE,
    ),
    'MISSING_PRODUCT_CATEGORY_FOR_VALIDATION': IssueDefinition(
        issue_code='MISSING_PRODUCT_CATEGORY_FOR_VALIDATION',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.REFERENCE_DATA,
        default_message=SALES_ISSUE_MESSAGES['MISSING_PRODUCT_CATEGORY_FOR_VALIDATION'],
    ),
    'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT': IssueDefinition(
        issue_code='PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.BUSINESS_RULE,
        default_message=SALES_ISSUE_MESSAGES['PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT'],
    ),
    'CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT': IssueDefinition(
        issue_code='CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.BUSINESS_RULE,
        default_message=SALES_ISSUE_MESSAGES['CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT'],
    ),
    'GROSS_WEIGHT_OUTSIDE_TOLERANCE': IssueDefinition(
        issue_code='GROSS_WEIGHT_OUTSIDE_TOLERANCE',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.RECONCILIATION,
        default_message=SALES_ISSUE_MESSAGES['GROSS_WEIGHT_OUTSIDE_TOLERANCE'],
    ),
    'INVALID_SALES_ACCOUNT': IssueDefinition(
        issue_code='INVALID_SALES_ACCOUNT',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.REFERENCE_DATA,
        default_message=SALES_ISSUE_MESSAGES['INVALID_SALES_ACCOUNT'],
    ),
    'INVALID_PRODUCT_MAPPING': IssueDefinition(
        issue_code='INVALID_PRODUCT_MAPPING',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.BUSINESS_RULE,
        default_message=SALES_ISSUE_MESSAGES['INVALID_PRODUCT_MAPPING'],
    ),
    'INVALID_LEDGER_MAPPING': IssueDefinition(
        issue_code='INVALID_LEDGER_MAPPING',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.BUSINESS_RULE,
        default_message='Sales account and product category do not match.',
    ),
    'PRODUCT_NOT_FOUND_IN_MASTER': IssueDefinition(
        issue_code='PRODUCT_NOT_FOUND_IN_MASTER',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.REFERENCE_DATA,
        default_message=SALES_ISSUE_MESSAGES['PRODUCT_NOT_FOUND_IN_MASTER'],
    ),
    'INVALID_RATE_DEVIATION': IssueDefinition(
        issue_code='INVALID_RATE_DEVIATION',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.BUSINESS_RULE,
        default_message=SALES_ISSUE_MESSAGES['INVALID_RATE_DEVIATION'],
    ),
    'RATE_MASTER_NOT_FOUND': IssueDefinition(
        issue_code='RATE_MASTER_NOT_FOUND',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.REFERENCE_DATA,
        default_message=SALES_ISSUE_MESSAGES['RATE_MASTER_NOT_FOUND'],
    ),
    'INVALID_UOM': IssueDefinition(
        issue_code='INVALID_UOM',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.BUSINESS_RULE,
        default_message=MSG_INVALID_UOM,
    ),
    'INVALID_UNIT_RATE_RANGE': IssueDefinition(
        issue_code='INVALID_UNIT_RATE_RANGE',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.BUSINESS_RULE,
        default_message=MSG_INVALID_UNIT_RATE_RANGE,
    ),
    'INVALID_FREE_QUANTITY': IssueDefinition(
        issue_code='INVALID_FREE_QUANTITY',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.BUSINESS_RULE,
        default_message='Unit rate must be between 0 and 1 for this product.',
    ),
    'HIGHER_SALES_RETURN_RATE': IssueDefinition(
        issue_code='HIGHER_SALES_RETURN_RATE',
        severity=IssueSeverity.MEDIUM,
        category=IssueCategory.BUSINESS_RULE,
        default_message='Higher sales return rate',
    ),
    'PRODUCT_NOT_FOUND_IN_SALES': IssueDefinition(
        issue_code='PRODUCT_NOT_FOUND_IN_SALES',
        severity=IssueSeverity.HIGH,
        category=IssueCategory.REFERENCE_DATA,
        default_message='Product not found in Sales Audit file.',
    ),
}


def registered_issue_codes() -> tuple[str, ...]:
    return tuple(sorted(_ISSUE_REGISTRY))


def get_issue_definition(issue_code: str) -> IssueDefinition:
    try:
        return _ISSUE_REGISTRY[issue_code]
    except KeyError as exc:
        raise KeyError(f'Unknown issue code: {issue_code}') from exc


def issue_message(issue_code: str, *, default: str | None = None) -> str:
    if default is not None:
        return default
    return get_issue_definition(issue_code).default_message


def messages_for_codes(issue_codes: list[str]) -> list[str]:
    seen: set[str] = set()
    messages: list[str] = []
    for issue_code in issue_codes:
        message = issue_message(issue_code)
        if message in seen:
            continue
        seen.add(message)
        messages.append(message)
    return messages


def build_issue(
    issue_code: str,
    *,
    row_number: int | None,
    source_processor: str,
    metadata: dict[str, Any] | None = None,
    detected_at: datetime | None = None,
    message: str | None = None,
    trace_id: str | None = None,
    processor_stage: str = 'validation',
) -> IssueRecord:
    definition = get_issue_definition(issue_code)
    detected = detected_at or datetime.now(UTC)
    trace_identifier = trace_id or str(uuid4())
    row_value = None if row_number is None else int(row_number)
    metadata_payload = dict(metadata or {})
    return IssueRecord(
        issue_code=definition.issue_code,
        severity=definition.severity.value,
        category=definition.category.value,
        row_number=row_value,
        message=message or definition.default_message,
        source_processor=source_processor,
        detected_at=detected.isoformat(),
        metadata=metadata_payload,
        audit_trace={
            'trace_id': trace_identifier,
            'processor_stage': processor_stage,
            'source_processor': source_processor,
            'row_number': row_value,
        },
    )


def build_issues(
    issue_codes: list[str],
    *,
    row_number: int | None,
    source_processor: str,
    metadata: dict[str, Any] | None = None,
    detected_at: datetime | None = None,
    processor_stage: str = 'validation',
) -> list[IssueRecord]:
    timestamp = detected_at or datetime.now(UTC)
    trace_identifier = str(uuid4())
    return [
        build_issue(
            issue_code,
            row_number=row_number,
            source_processor=source_processor,
            metadata=metadata,
            detected_at=timestamp,
            trace_id=trace_identifier,
            processor_stage=processor_stage,
        )
        for issue_code in issue_codes
    ]

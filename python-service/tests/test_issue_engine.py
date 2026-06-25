from datetime import UTC, datetime

import pytest

from app.core.issue_engine import (
    build_issue,
    build_issues,
    get_issue_definition,
    messages_for_codes,
    registered_issue_codes,
)


def test_registered_issue_codes_cover_current_processors() -> None:
    expected = {
        'MISSING_REQUIRED_COLUMNS',
        'MISSING_PAN_ABOVE_2L',
        'VALID_PAN',
        'INVALID_PAN_FORMAT',
        'MISSING_ADDRESS_PROOF_ABOVE_50K',
        'NEGATIVE_WEIGHT_VALUES',
        'GROSS_WEIGHT_MISMATCH',
        'GROSS_WEIGHT_DIFFERENCE_VIOLATION',
        'MISSING_PRODUCT_CATEGORY_FOR_VALIDATION',
        'PRODUCT_CATEGORY_DOES_NOT_MATCH_SALES_ACCOUNT',
        'CONFLICTING_SALES_ACCOUNT_FOR_PRODUCT',
        'GROSS_WEIGHT_OUTSIDE_TOLERANCE',
        'INVALID_SALES_ACCOUNT',
        'INVALID_PRODUCT_MAPPING',
        'PRODUCT_NOT_FOUND_IN_MASTER',
        'INVALID_RATE_DEVIATION',
        'RATE_MASTER_NOT_FOUND',
    }
    assert expected <= set(registered_issue_codes())


def test_build_issue_returns_enterprise_issue_payload() -> None:
    detected_at = datetime(2026, 5, 11, 17, 30, tzinfo=UTC)
    issue = build_issue(
        'GROSS_WEIGHT_MISMATCH',
        row_number=17,
        source_processor='gross_weight',
        detected_at=detected_at,
        metadata={'manualGrossWeight': 10.5, 'autoGrossWeight': 11.0},
    )
    payload = issue.to_dict()
    assert payload['issue_code'] == 'GROSS_WEIGHT_MISMATCH'
    assert payload['severity'] == 'medium'
    assert payload['category'] == 'reconciliation'
    assert payload['row_number'] == 17
    assert payload['source_processor'] == 'gross_weight'
    assert payload['detected_at'] == detected_at.isoformat()
    assert payload['metadata']['manualGrossWeight'] == 10.5
    assert payload['audit_trace']['row_number'] == 17
    assert payload['audit_trace']['processor_stage'] == 'validation'


def test_messages_for_codes_deduplicates_shared_messages() -> None:
    messages = messages_for_codes(
        ['MISSING_PAN_ABOVE_2L', 'INVALID_PAN_FORMAT', 'MISSING_ADDRESS_PROOF_ABOVE_50K']
    )
    assert len(messages) == 2
    assert messages[0] == get_issue_definition('MISSING_PAN_ABOVE_2L').default_message
    assert messages[1] == get_issue_definition('MISSING_ADDRESS_PROOF_ABOVE_50K').default_message


def test_build_issues_shares_trace_identifier_for_same_detection_batch() -> None:
    issues = build_issues(
        ['MISSING_PAN_ABOVE_2L', 'MISSING_ADDRESS_PROOF_ABOVE_50K'],
        row_number=9,
        source_processor='pan',
        metadata={'voucherNo': 'VN-9'},
    )
    assert len(issues) == 2
    trace_ids = {issue.audit_trace['trace_id'] for issue in issues}
    assert len(trace_ids) == 1
    assert all(issue.row_number == 9 for issue in issues)


def test_unknown_issue_code_raises_key_error() -> None:
    with pytest.raises(KeyError):
        get_issue_definition('NOT_A_REAL_ISSUE_CODE')

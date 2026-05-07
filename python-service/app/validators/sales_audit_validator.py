"""Pure sales-audit rules: expected vs predicted product category."""

from __future__ import annotations

SALES_AUDIT_MISMATCH_ISSUE = 'Product category does not match Sales Account'


def evaluate_category_match(
    expected_category: str | None,
    predicted_category: str | None,
) -> tuple[bool, list[str]]:
    """
    When ``expected_category`` is missing (no karat/jadau on sales account), row is valid.

    Otherwise prediction must equal expectation or the row is invalid.
    """
    if expected_category is None:
        return True, []
    if predicted_category is None:
        return False, [SALES_AUDIT_MISMATCH_ISSUE]
    if predicted_category != expected_category:
        return False, [SALES_AUDIT_MISMATCH_ISSUE]
    return True, []

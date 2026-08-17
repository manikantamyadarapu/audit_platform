/**
 * @param {unknown} body
 * @returns {{ ok: true, records: object[] } | { ok: false, detail: string }}
 */
function validateRateComparisonExportBody(body) {
  const records = body?.records;
  if (!Array.isArray(records) || records.length === 0) {
    return { ok: false, detail: 'Request body must include a non-empty "records" array' };
  }
  return { ok: true, records };
}

/**
 * Consolidated export accepts any non-empty combination of records,
 * validationIssues, or comparisonIssues.
 *
 * @param {unknown} body
 * @returns {{ ok: true, payload: object } | { ok: false, detail: string }}
 */
function validateExceptionsExportBody(body) {
  const { records, validationIssues, comparisonIssues, exportColumns, columnDisplayHeaders } =
    body ?? {};
  const hasRecords = Array.isArray(records) && records.length > 0;
  const hasValidation = Array.isArray(validationIssues) && validationIssues.length > 0;
  const hasComparison = Array.isArray(comparisonIssues) && comparisonIssues.length > 0;

  if (!hasRecords && !hasValidation && !hasComparison) {
    return {
      ok: false,
      detail: 'Request body must include non-empty "records" or validation/comparison issue arrays',
    };
  }

  return {
    ok: true,
    payload: { records, validationIssues, comparisonIssues, exportColumns, columnDisplayHeaders },
    counts: {
      recordCount: hasRecords ? records.length : 0,
      validationCount: hasValidation ? validationIssues.length : 0,
      comparisonCount: hasComparison ? comparisonIssues.length : 0,
    },
  };
}

module.exports = { validateRateComparisonExportBody, validateExceptionsExportBody };

/**
 * Validate Financials Closing Stock export request bodies.
 */

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {{ ok: true, rows: object[] } | { ok: false, detail: string }}
 */
function validatePivotArray(value, field) {
  if (value == null) {
    return { ok: true, rows: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, detail: `"${field}" must be an array` };
  }
  return { ok: true, rows: value };
}

/**
 * @param {unknown} body
 * @returns {{
 *   ok: true,
 *   salesPivot: object[],
 *   purchasesPivot: object[],
 *   openingPivot: object[],
 *   receiptsPivot: object[],
 *   issuesPivot: object[],
 * } | { ok: false, detail: string }}
 */
function validateFinancialsExportPivotsBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, detail: 'Request body must be a JSON object' };
  }

  const sales = validatePivotArray(body.salesPivot, 'salesPivot');
  if (!sales.ok) return sales;
  const purchases = validatePivotArray(body.purchasesPivot, 'purchasesPivot');
  if (!purchases.ok) return purchases;
  const opening = validatePivotArray(body.openingPivot, 'openingPivot');
  if (!opening.ok) return opening;
  const receipts = validatePivotArray(body.receiptsPivot, 'receiptsPivot');
  if (!receipts.ok) return receipts;
  const issues = validatePivotArray(body.issuesPivot, 'issuesPivot');
  if (!issues.ok) return issues;

  return {
    ok: true,
    salesPivot: sales.rows,
    purchasesPivot: purchases.rows,
    openingPivot: opening.rows,
    receiptsPivot: receipts.rows,
    issuesPivot: issues.rows,
  };
}

/**
 * @param {unknown} body
 * @returns {{
 *   ok: true,
 *   products: string[],
 *   salesPivot: object[],
 *   purchasesPivot: object[],
 *   openingPivot: object[],
 *   receiptsPivot: object[],
 *   issuesPivot: object[],
 *   companyName: string,
 *   address: string,
 *   financialYear: string,
 * } | { ok: false, detail: string }}
 */
function validateClosingStockExportBody(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, detail: 'Request body must be a JSON object' };
  }

  if (body.products != null && !Array.isArray(body.products)) {
    return { ok: false, detail: '"products" must be an array' };
  }

  const sales = validatePivotArray(body.salesPivot, 'salesPivot');
  if (!sales.ok) return sales;
  const purchases = validatePivotArray(body.purchasesPivot, 'purchasesPivot');
  if (!purchases.ok) return purchases;
  const opening = validatePivotArray(body.openingPivot, 'openingPivot');
  if (!opening.ok) return opening;
  const receipts = validatePivotArray(body.receiptsPivot, 'receiptsPivot');
  if (!receipts.ok) return receipts;
  const issues = validatePivotArray(body.issuesPivot, 'issuesPivot');
  if (!issues.ok) return issues;

  const companyName = body.companyName == null ? '' : String(body.companyName);
  const address = body.address == null ? '' : String(body.address);
  const financialYear =
    body.financialYear == null || body.financialYear === ''
      ? 'AY 2025-26'
      : String(body.financialYear);

  return {
    ok: true,
    products: Array.isArray(body.products) ? body.products.map(String) : [],
    salesPivot: sales.rows,
    purchasesPivot: purchases.rows,
    openingPivot: opening.rows,
    receiptsPivot: receipts.rows,
    issuesPivot: issues.rows,
    companyName,
    address,
    financialYear,
  };
}

module.exports = {
  validateFinancialsExportPivotsBody,
  validateClosingStockExportBody,
};

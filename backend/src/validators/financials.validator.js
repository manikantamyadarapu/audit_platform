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

function validateLocationPivots(value, field) {
  if (value == null) {
    return {
      ok: true,
      tree: { jubileeHills: [], kokapet: [], internalBasheerbagh: [] },
    };
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, detail: `"${field}" must be an object` };
  }
  const jubilee = validatePivotArray(value.jubileeHills, `${field}.jubileeHills`);
  if (!jubilee.ok) return jubilee;
  const kokapet = validatePivotArray(value.kokapet, `${field}.kokapet`);
  if (!kokapet.ok) return kokapet;
  const internal = validatePivotArray(
    value.internalBasheerbagh,
    `${field}.internalBasheerbagh`
  );
  if (!internal.ok) return internal;
  return {
    ok: true,
    tree: {
      jubileeHills: jubilee.rows,
      kokapet: kokapet.rows,
      internalBasheerbagh: internal.rows,
    },
  };
}

/**
 * @param {unknown} body
 * @returns {{
 *   ok: true,
 *   salesPivot: object[],
 *   purchasesPivot: object[],
 *   openingPivot: object[],
 *   mrPivots: object,
 *   dcPivots: object,
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
  const mrPivots = validateLocationPivots(body.mrPivots, 'mrPivots');
  if (!mrPivots.ok) return mrPivots;
  const dcPivots = validateLocationPivots(body.dcPivots, 'dcPivots');
  if (!dcPivots.ok) return dcPivots;

  return {
    ok: true,
    salesPivot: sales.rows,
    purchasesPivot: purchases.rows,
    openingPivot: opening.rows,
    mrPivots: mrPivots.tree,
    dcPivots: dcPivots.tree,
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
  const mrPivots = validateLocationPivots(body.mrPivots, 'mrPivots');
  if (!mrPivots.ok) return mrPivots;
  const dcPivots = validateLocationPivots(body.dcPivots, 'dcPivots');
  if (!dcPivots.ok) return dcPivots;

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
    mrPivots: mrPivots.tree,
    dcPivots: dcPivots.tree,
    companyName,
    address,
    financialYear,
  };
}

module.exports = {
  validateFinancialsExportPivotsBody,
  validateClosingStockExportBody,
};

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

  const salesReturn = validatePivotArray(body.salesReturnPivot, 'salesReturnPivot');
  if (!salesReturn.ok) return salesReturn;
  const purchaseReturn = validatePivotArray(body.purchaseReturnPivot, 'purchaseReturnPivot');
  if (!purchaseReturn.ok) return purchaseReturn;
  const debitNote = validatePivotArray(body.supplierDebitNotePivot, 'supplierDebitNotePivot');
  if (!debitNote.ok) return debitNote;
  const creditNote = validatePivotArray(body.supplierCreditNotePivot, 'supplierCreditNotePivot');
  if (!creditNote.ok) return creditNote;

  const sourceAverageRates =
    body.sourceAverageRates && typeof body.sourceAverageRates === 'object' && !Array.isArray(body.sourceAverageRates)
      ? body.sourceAverageRates
      : {};
  const receiptRateMappings = Array.isArray(body.receiptRateMappings) ? body.receiptRateMappings : [];
  const destinationBranch =
    body.destinationBranch == null ? '' : String(body.destinationBranch);

  return {
    ok: true,
    salesPivot: sales.rows,
    purchasesPivot: purchases.rows,
    openingPivot: opening.rows,
    salesReturnPivot: salesReturn.rows,
    purchaseReturnPivot: purchaseReturn.rows,
    supplierDebitNotePivot: debitNote.rows,
    supplierCreditNotePivot: creditNote.rows,
    mrPivots: mrPivots.tree,
    dcPivots: dcPivots.tree,
    sourceAverageRates,
    receiptRateMappings,
    destinationBranch,
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
  const sourceAverageRates =
    body.sourceAverageRates && typeof body.sourceAverageRates === 'object' && !Array.isArray(body.sourceAverageRates)
      ? body.sourceAverageRates
      : {};
  const receiptRateMappings = Array.isArray(body.receiptRateMappings) ? body.receiptRateMappings : [];
  const destinationBranch =
    body.destinationBranch == null ? '' : String(body.destinationBranch);
  const transfer = validateExportTransferFields(body);
  if (!transfer.ok) return transfer;

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
    destinationBranch,
    sourceAverageRates,
    receiptRateMappings,
    ...transfer.fields,
  };
}

function optionalObject(value, name) {
  if (value == null) return { ok: true, value: {} };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, detail: `"${name}" must be an object` };
  }
  return { ok: true, value };
}

function validateExportTransferFields(body) {
  const layout = optionalObject(body.layoutByCategory, 'layoutByCategory');
  if (!layout.ok) return layout;
  const sourceIssueLayouts = optionalObject(body.sourceIssueLayouts, 'sourceIssueLayouts');
  if (!sourceIssueLayouts.ok) return sourceIssueLayouts;
  const sourceOpeningComplete = optionalObject(body.sourceOpeningComplete, 'sourceOpeningComplete');
  if (!sourceOpeningComplete.ok) return sourceOpeningComplete;
  const sourceOpeningPending = optionalObject(body.sourceOpeningPending, 'sourceOpeningPending');
  if (!sourceOpeningPending.ok) return sourceOpeningPending;
  const sourceTransferLines = optionalObject(body.sourceTransferLines, 'sourceTransferLines');
  if (!sourceTransferLines.ok) return sourceTransferLines;
  const destinationTransferLines = optionalObject(
    body.destinationTransferLines,
    'destinationTransferLines'
  );
  if (!destinationTransferLines.ok) return destinationTransferLines;
  return {
    ok: true,
    fields: {
      layoutByCategory: layout.value,
      sourceIssueLayouts: sourceIssueLayouts.value,
      sourceOpeningComplete: sourceOpeningComplete.value,
      sourceOpeningPending: sourceOpeningPending.value,
      sourceTransferLines: sourceTransferLines.value,
      destinationTransferLines: destinationTransferLines.value,
    },
  };
}

module.exports = {
  validateFinancialsExportPivotsBody,
  validateClosingStockExportBody,
  validateExportTransferFields,
};

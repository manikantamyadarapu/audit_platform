/**
 * Opening Stock pending rows must survive the Financials session slim.
 * The panel reads openingStockReport.manualMappingRequired, including candidates.
 */

function text(value) {
  return String(value || '').trim();
}

export function slimOpeningCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const product = text(candidate.product || candidate.sheetName);
  if (!product) return null;
  return {
    product,
    sheetName: candidate.sheetName ?? null,
    category: candidate.category ?? null,
    subcategory: candidate.subcategory ?? null,
    closingStockQty: candidate.closingStockQty ?? candidate.closingQty ?? null,
    closingStockAmount: candidate.closingStockAmount ?? candidate.closingAmt ?? candidate.closingBalanceAmount ?? null,
    closingBalanceAmount: candidate.closingBalanceAmount ?? candidate.closingStockAmount ?? candidate.closingAmt ?? null,
    source: candidate.source ?? null,
  };
}

export function slimOpeningPendingRow(row) {
  if (!row || typeof row !== 'object') return row;
  const candidates = Array.isArray(row.candidateProducts)
    ? row.candidateProducts.map(slimOpeningCandidate).filter(Boolean)
    : [];
  return {
    product: row.product ?? '',
    category: row.category ?? null,
    subcategory: row.subcategory ?? null,
    openingQty: row.openingQty ?? row.sumOfQuantity ?? null,
    openingAmt: row.openingAmt ?? null,
    status: row.status ?? null,
    reason: row.reason ?? null,
    sheetName: row.sheetName ?? row.category ?? null,
    ruleBookProduct: row.ruleBookProduct ?? null,
    previousYearProducts: Array.isArray(row.previousYearProducts) ? row.previousYearProducts : [],
    previousClosingQty: row.previousClosingQty ?? null,
    previousClosingAmount: row.previousClosingAmount ?? null,
    candidateProducts: candidates,
  };
}

function slimMatchedRow(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    product: row.product ?? '',
    category: row.category ?? null,
    subcategory: row.subcategory ?? null,
    openingQty: row.openingQty ?? row.sumOfQuantity ?? null,
    openingAmt: row.openingAmt ?? null,
    status: row.status ?? null,
    reason: row.reason ?? null,
    sheetName: row.sheetName ?? null,
    ruleBookProduct: row.ruleBookProduct ?? null,
    previousYearProduct: row.previousYearProduct ?? null,
    previousYearProducts: Array.isArray(row.previousYearProducts) ? row.previousYearProducts : [],
  };
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function readOpeningStockReport(result) {
  const root = result?.openingStockReport;
  const summary = result?.summary?.openingStockReport;
  const rootRows = list(root?.manualMappingRequired).length || list(root?.previousYearMappingRequired).length;
  const summaryRows =
    list(summary?.manualMappingRequired).length || list(summary?.previousYearMappingRequired).length;
  if (summaryRows > rootRows) return summary;
  return root || summary || null;
}

export function slimOpeningStockReport(report) {
  if (!report || typeof report !== 'object') return null;
  const manual = list(report.manualMappingRequired).length
    ? list(report.manualMappingRequired)
    : list(report.previousYearMappingRequired);
  const manualRows = manual.map(slimOpeningPendingRow);
  const fallback = list(report.fallbackMatched).map(slimMatchedRow);
  return {
    exactMatchedCount: report.exactMatchedCount ?? report.matchedCount ?? 0,
    fallbackMatchedCount: fallback.length || report.fallbackMatchedCount || 0,
    manualMappingRequiredCount: manualRows.length,
    previousYearMappingRequiredCount: manualRows.length,
    quantityMismatchCount: list(report.quantityMismatch).length || report.quantityMismatchCount || 0,
    unmatchedCount: list(report.unmatched || report.missingFromPreviousYearFile).length || report.unmatchedCount || 0,
    totalOpeningQty: report.totalOpeningQty ?? null,
    totalOpeningAmount: report.totalOpeningAmount ?? null,
    mappedToClosingStockCount: report.mappedToClosingStockCount ?? 0,
    manualMappingRequired: manualRows,
    previousYearMappingRequired: manualRows,
    fallbackMatched: fallback,
    quantityMismatch: list(report.quantityMismatch).map(slimOpeningPendingRow),
    unmatched: list(report.unmatched || report.missingFromPreviousYearFile).map(slimMatchedRow),
  };
}

function isManualStatus(status) {
  const value = text(status);
  return value === 'manual_mapping_required' || value === 'previous_year_mapping_required';
}

function pendingFromStoredRows(result) {
  const seen = new Set();
  const rows = [];
  const sources = [...list(result?.validatedOpening), ...list(result?.openingPivot)];
  for (const row of sources) {
    if (!isManualStatus(row?.status)) continue;
    const product = text(row?.product);
    if (!product || seen.has(product)) continue;
    seen.add(product);
    rows.push(slimOpeningPendingRow(row));
  }
  return rows;
}

/** Put this session's pending and resolved Opening Stock rows back on the result. */
export function attachOpeningStockReport(result) {
  if (!result || typeof result !== 'object') return result;
  const existing = readOpeningStockReport(result);
  let report = existing ? slimOpeningStockReport(existing) : null;
  if (!report) {
    const rebuilt = pendingFromStoredRows(result);
    if (!rebuilt.length) return result;
    report = slimOpeningStockReport({
      manualMappingRequired: rebuilt,
      manualMappingRequiredCount: rebuilt.length,
    });
  }
  return {
    ...result,
    openingStockReport: report,
    summary: {
      ...(result.summary || {}),
      openingStockReport: report,
    },
  };
}

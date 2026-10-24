/**
 * Persist Opening Stock manual mappings per Financials branch (localStorage).
 * Survives branch switches and re-process of held files (same idea as Jubilee Hills).
 */

import {
  readSessionOpeningMappings,
  writeSessionOpeningMappings,
} from './financialsMappingSession.js';
import {
  attachOpeningStockReport,
  readOpeningStockReport,
} from './openingStockReportPersistence.js';
import { withoutResolvedReceiptReviews } from './mappingPendingLists.js';
import { readReceiptRateMappings } from './receiptRateMappings.js';

const STORAGE_KEY = 'financials-opening-stock-mappings';

export function openingMappingStorageKey() {
  return STORAGE_KEY;
}

function coerceNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function candidateAmt(row) {
  return coerceNumber(row?.closingStockAmount ?? row?.closingAmt);
}

/**
 * Apply a confirmed manual Opening Stock mapping into process result + pivots.
 * Writes Opening Qty/Amt onto the Closing Stock layout via matched_fallback status.
 */
export function applyManualOpeningMapping(result, mapping) {
  const {
    product,
    ruleBookProduct,
    category,
    subcategory,
    openingQty,
    openingAmt,
    previousYearProducts,
  } = mapping || {};

  const productKey = String(product || '').trim();
  if (!productKey || openingAmt == null) return result;

  const claimed = new Set(
    (previousYearProducts || []).map((name) => String(name || '').trim()).filter(Boolean)
  );

  const openingPivot = (Array.isArray(result?.openingPivot) ? result.openingPivot : []).map(
    (row) => {
      if (String(row?.product || '').trim() !== productKey) return row;
      return {
        ...row,
        product: productKey,
        ruleBookProduct: ruleBookProduct || productKey,
        category: category || null,
        subcategory: subcategory || null,
        status: 'matched_fallback',
        sumOfQuantity: openingQty,
        sumOfGross: openingAmt,
      };
    }
  );
  const existingPivot = openingPivot.some((row) => String(row?.product || '').trim() === productKey);
  if (!existingPivot) {
    openingPivot.push({
      product: productKey,
      ruleBookProduct: ruleBookProduct || productKey,
      category: category || null,
      subcategory: subcategory || null,
      status: 'matched_fallback',
      sumOfQuantity: openingQty,
      sumOfGross: openingAmt,
    });
  }

  const validatedOpening = (Array.isArray(result?.validatedOpening) ? result.validatedOpening : [])
    .map((row) => {
      if (String(row?.product || '').trim() !== productKey) return row;
      return {
        ...row,
        openingQty,
        openingAmt,
        status: 'matched_fallback',
        reason: 'matched_via_manual_mapping',
        ruleBookProduct: ruleBookProduct || productKey,
        category: category || null,
        subcategory: subcategory || null,
        previousYearProducts,
      };
    });

  const report = { ...(readOpeningStockReport(result) || {}) };
  const sourceManual = Array.isArray(report.manualMappingRequired)
    ? report.manualMappingRequired
    : Array.isArray(report.previousYearMappingRequired)
      ? report.previousYearMappingRequired
      : [];
  let removedMappedRow = false;
  const manualList = sourceManual
    .filter((row) => {
      if (!removedMappedRow && String(row?.product || '').trim() === productKey) {
        removedMappedRow = true;
        return false;
      }
      return true;
    })
    .map((row) => ({
      ...row,
      candidateProducts: (row.candidateProducts || []).filter((candidate) => {
        const name = String(candidate.product || candidate.sheetName || '').trim();
        return name && !claimed.has(name);
      }),
    }));
  const fallbackMatched = [
    ...(Array.isArray(report.fallbackMatched) ? report.fallbackMatched : []),
    {
      product: productKey,
      openingQty,
      openingAmt,
      status: 'matched_fallback',
      reason: 'matched_via_manual_mapping',
      ruleBookProduct: ruleBookProduct || productKey,
      category,
      subcategory,
      previousYearProducts,
    },
  ];

  const totalOpeningQty = validatedOpening.reduce((sum, row) => {
    const qty = coerceNumber(row?.openingQty);
    return qty == null ? sum : sum + qty;
  }, 0);
  const totalOpeningAmount = validatedOpening.reduce((sum, row) => {
    const amt = coerceNumber(row?.openingAmt);
    return amt == null ? sum : sum + amt;
  }, 0);

  const nextReport = {
    ...report,
    manualMappingRequired: manualList,
    manualMappingRequiredCount: manualList.length,
    previousYearMappingRequired: manualList,
    previousYearMappingRequiredCount: manualList.length,
    fallbackMatched,
    fallbackMatchedCount: fallbackMatched.length,
    matchedCount: (report.exactMatchedCount || 0) + fallbackMatched.length,
    totalOpeningQty,
    totalOpeningAmount,
  };

  return {
    ...result,
    openingPivot,
    validatedOpening,
    openingStockReport: nextReport,
    summary: {
      ...(result?.summary || {}),
      openingStockReport: nextReport,
      openingTotalQuantity: totalOpeningQty,
      openingTotalAmount: totalOpeningAmount,
    },
  };
}

export function readOpeningStockMappings(branch) {
  if (!branch) return [];
  return readSessionOpeningMappings(branch);
}

export function saveOpeningStockMapping(branch, mapping) {
  if (!branch || !mapping?.product) return readOpeningStockMappings(branch);
  const product = String(mapping.product).trim();
  const previousYearProducts = (
    Array.isArray(mapping.previousYearProducts)
      ? mapping.previousYearProducts
      : [mapping.previousYearProduct]
  )
    .map((name) => String(name || '').trim())
    .filter(Boolean);
  if (!product || !previousYearProducts.length) {
    return readOpeningStockMappings(branch);
  }

  const current = readOpeningStockMappings(branch);
  const next = current.filter((row) => String(row?.product || '').trim() !== product);
  next.push({
    product,
    previousYearProduct: previousYearProducts[0],
    previousYearProducts,
    ruleBookProduct: mapping.ruleBookProduct || product,
    category: mapping.category || null,
    subcategory: mapping.subcategory || null,
  });
  writeSessionOpeningMappings(branch, next);
  return next;
}

/**
 * Re-apply saved Opening Stock mappings onto a fresh process result.
 * Resolves amounts from the current manual-mapping candidate list when possible.
 */
export function reapplyOpeningStockMappings(result, branch) {
  if (!result || !branch) return result;
  const saved = readOpeningStockMappings(branch);
  if (!saved.length) return result;

  let next = result;
  for (const mapping of saved) {
    const product = String(mapping.product || '').trim();
    if (!product) continue;

    const report = readOpeningStockReport(next) || {};
    const pending = Array.isArray(report.manualMappingRequired)
      ? report.manualMappingRequired
      : Array.isArray(report.previousYearMappingRequired)
        ? report.previousYearMappingRequired
        : [];
    const row = pending.find((item) => String(item?.product || '').trim() === product);
    if (!row) continue;

    const wanted = new Set(
      (mapping.previousYearProducts || [mapping.previousYearProduct])
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    );
    const selected = (row.candidateProducts || []).filter((candidate) => {
      const name = String(candidate?.product || candidate?.sheetName || '').trim();
      return name && wanted.has(name);
    });
    if (!selected.length) continue;

    const openingAmt = selected.reduce((sum, candidate) => {
      const amt = candidateAmt(candidate);
      return amt == null ? sum : sum + amt;
    }, 0);
    const openingQty = coerceNumber(row.openingQty);
    if (openingAmt == null && openingQty == null) continue;

    next = applyManualOpeningMapping(next, {
      product,
      ruleBookProduct: mapping.ruleBookProduct || row.ruleBookProduct || product,
      category: mapping.category || row.category || null,
      subcategory: mapping.subcategory || row.subcategory || null,
      openingQty,
      openingAmt,
      previousYearProducts: selected.map((candidate) =>
        String(candidate.product || candidate.sheetName || '').trim()
      ),
    });
  }
  return next;
}

/** Restore this session's mappings before pending lists are shown. */
export function restoreFinancialsMappings(result, branch) {
  if (!result || !branch) return result;
  const withOpening = reapplyOpeningStockMappings(attachOpeningStockReport(result), branch);
  if (!Array.isArray(withOpening.receiptAmountReview)) return withOpening;
  return {
    ...withOpening,
    receiptAmountReview: withoutResolvedReceiptReviews(
      withOpening.receiptAmountReview,
      readReceiptRateMappings(branch)
    ),
  };
}

/**
 * Fill Receipt Amounts from source-branch Average Rates as soon as each
 * product is ready. Does not wait for every opening mapping, and does not
 * re-run process.
 *
 * A product is ready after process when Opening Stock already matched.
 * If it still needs mapping, destinations wait until that product is mapped.
 */

import { openingMappingPendingCount } from './mappingPendingLists.js';
import { readReceiptRateMappings } from './receiptRateMappings.js';
import { readSourceAverageRates, saveBranchAverageRates } from './sourceAverageRates.js';

export const RECEIPT_RATE_BRANCHES = Object.freeze(['basheerbagh', 'kokapet', 'jubileeHills']);
export const FINANCIALS_RECEIPT_RATES_EVENT = 'financials-receipt-rates-changed';

const BRANCH_SPECS = Object.freeze([
  { rateKey: 'basheerbagh', sessionKey: 'financials-sales-purchases', kind: 'closing' },
  { rateKey: 'kokapet', sessionKey: 'financials-kokapet', kind: 'closing' },
  { rateKey: 'jubileeHills', sessionKey: 'financials-jubilee-hills', kind: 'jubilee' },
]);

export function receiptRateBranchKey(destinationBranch) {
  if (destinationBranch === 'kokapet') return 'kokapet';
  if (destinationBranch === 'jubilee-hills' || destinationBranch === 'jubileeHills') {
    return 'jubileeHills';
  }
  return 'basheerbagh';
}

function pendingOpeningNames(result) {
  const names = new Set();
  const report = result?.openingStockReport || result?.summary?.openingStockReport;
  for (const row of report?.manualMappingRequired || []) {
    const name = String(row?.product || '').trim();
    if (name) names.add(name);
  }
  for (const row of result?.openingAmountMatch?.manualMappingRequiredRows || []) {
    const name = String(row?.product || '').trim();
    if (name) names.add(name);
  }
  return names;
}

export function readyAverageRates(result) {
  const pending = pendingOpeningNames(result);
  return (Array.isArray(result?.productAverageRates) ? result.productAverageRates : []).filter(
    (row) => {
      const name = String(row?.product || '').trim();
      return Boolean(name) && !pending.has(name) && row?.averageRateAmt != null && row.averageRateAmt !== '';
    }
  );
}

function hasPivots(result) {
  if (!result || typeof result !== 'object') return false;
  return Boolean(
    (Array.isArray(result.salesPivot) && result.salesPivot.length) ||
      (Array.isArray(result.netSalesPivot) && result.netSalesPivot.length) ||
      (Array.isArray(result.purchasesPivot) && result.purchasesPivot.length) ||
      (Array.isArray(result.openingPivot) && result.openingPivot.length) ||
      (result.layoutByCategory && Object.keys(result.layoutByCategory).length)
  );
}

function locationTree(tree) {
  const source = tree && typeof tree === 'object' ? tree : {};
  return {
    jubileeHills: Array.isArray(source.jubileeHills) ? source.jubileeHills : [],
    kokapet: Array.isArray(source.kokapet) ? source.kokapet : [],
    internalBasheerbagh: Array.isArray(source.internalBasheerbagh)
      ? source.internalBasheerbagh
      : [],
  };
}

function sourceOpeningComplete(result) {
  return hasPivots(result) && openingMappingPendingCount(result) === 0;
}

function transferLines(result) {
  const lines = result?.transferLines;
  if (lines && typeof lines === 'object') {
    return {
      mr: Array.isArray(lines.mr) ? lines.mr : [],
      dc: Array.isArray(lines.dc) ? lines.dc : [],
    };
  }
  return { mr: [], dc: [] };
}

function collectIssueDrops(results) {
  const sourceIssueLayouts = {};
  const sourceOpeningCompleteFlags = {};
  const sourceOpeningPending = {};
  const sourceTransferLines = {};
  for (const spec of BRANCH_SPECS) {
    const result = results[spec.rateKey];
    if (!result?.layoutByCategory) continue;
    sourceIssueLayouts[spec.rateKey] = result.layoutByCategory;
    sourceOpeningCompleteFlags[spec.rateKey] = sourceOpeningComplete(result);
    sourceOpeningPending[spec.rateKey] = [...pendingOpeningNames(result)];
    sourceTransferLines[spec.rateKey] = transferLines(result);
  }
  return {
    sourceIssueLayouts,
    sourceOpeningComplete: sourceOpeningCompleteFlags,
    sourceOpeningPending,
    sourceTransferLines,
  };
}

function remapPayload(spec, result, rates) {
  const mrPivots = locationTree(result.mrPivots || result.transferPivots?.mrPivots);
  const dcPivots = locationTree(result.dcPivots || result.transferPivots?.dcPivots);
  const shared = {
    salesPivot: result.netSalesPivot?.length ? result.netSalesPivot : result.salesPivot || [],
    purchasesPivot: result.netPurchasesPivot?.length
      ? result.netPurchasesPivot
      : result.purchasesPivot || [],
    openingPivot: result.openingPivot || [],
    mrPivots,
    dcPivots,
    sourceAverageRates: rates,
    receiptRateMappings: readReceiptRateMappings(
      spec.rateKey === 'jubileeHills' ? 'jubilee-hills' : spec.rateKey
    ),
  };
  if (spec.kind === 'jubilee') {
    return {
      ...shared,
      salesReturnPivot: result.salesReturnPivot || [],
      purchaseReturnPivot: result.purchaseReturnPivot || [],
      supplierDebitNotePivot: result.supplierDebitNotePivot || [],
      supplierCreditNotePivot: result.supplierCreditNotePivot || [],
    };
  }
  return {
    ...shared,
    destinationBranch: spec.rateKey,
  };
}

function applyFill(result, payload) {
  if (!payload) return result;
  return {
    ...result,
    productsByCategory: payload.productsByCategory ?? result.productsByCategory,
    layoutByCategory: payload.layoutByCategory ?? result.layoutByCategory,
    unmappedProducts: payload.unmappedProducts ?? result.unmappedProducts,
    unmappedProductDetails: payload.unmappedProductDetails ?? result.unmappedProductDetails,
    receiptAmountReview: Array.isArray(payload.receiptAmountReview)
      ? payload.receiptAmountReview
      : result.receiptAmountReview || [],
    transferReview: Array.isArray(payload.transferReview)
      ? payload.transferReview
      : result.transferReview || [],
    transferLines: payload.transferLines || result.transferLines,
    productAverageRates: payload.productAverageRates ?? result.productAverageRates ?? [],
    summary: {
      ...(result.summary || {}),
      ...(payload.summary || {}),
    },
  };
}

function collectRates(results) {
  const rates = { ...readSourceAverageRates() };
  for (const spec of BRANCH_SPECS) {
    const result = results[spec.rateKey];
    if (!result) continue;
    const rows = readyAverageRates(result);
    if (rows.length) rates[spec.rateKey] = rows;
  }
  return rates;
}

async function sessionStore() {
  return import('./auditSessionStorage.js');
}

function layoutSize(result) {
  const layout = result?.layoutByCategory;
  if (!layout || typeof layout !== 'object') return 0;
  return Object.values(layout).reduce(
    (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
    0
  );
}

function pickRicherResult(local, overflow) {
  const localOk = hasPivots(local);
  const overflowOk = hasPivots(overflow);
  if (localOk && overflowOk) {
    return layoutSize(overflow) > layoutSize(local) ? overflow : local;
  }
  if (overflowOk) return overflow;
  if (localOk) return local;
  return null;
}

async function defaultLoadBranchResult(sessionKey) {
  const storage = await sessionStore();
  const local = storage.bootstrapAuditSessionState(sessionKey)?.data?.result;
  let overflowResult = null;
  try {
    overflowResult = (await storage.loadAuditSessionOverflow(sessionKey))?.data?.result;
  } catch {
    overflowResult = null;
  }
  return pickRicherResult(local, overflowResult);
}

async function defaultPersistBranchResult(sessionKey, result) {
  const storage = await sessionStore();
  const local = storage.bootstrapAuditSessionState(sessionKey)?.data || {};
  let overflowData = null;
  try {
    overflowData = (await storage.loadAuditSessionOverflow(sessionKey))?.data || null;
  } catch {
    overflowData = null;
  }
  const snapshot = { ...(overflowData || local), result };
  const slim = storage.aggressiveSlimSnapshotForRegistry(sessionKey, snapshot);
  storage.saveAuditSession(sessionKey, slim);
  try {
    await storage.saveAuditSessionOverflow(sessionKey, slim);
  } catch {
    /* localStorage copy is enough */
  }
}

async function remapBranch(spec, result, rates, deps, issueDrops = {}) {
  if (result?.layoutByCategory && Object.keys(result.layoutByCategory).length) {
    const fill =
      deps.fillReceiptAmountsFromLayout ||
      (await import('../services/financials.service.js')).fillReceiptAmountsFromLayout;
    return fill({
      destinationBranch: spec.rateKey,
      layoutByCategory: result.layoutByCategory,
      sourceAverageRates: rates,
      receiptRateMappings: readReceiptRateMappings(
        spec.rateKey === 'jubileeHills' ? 'jubilee-hills' : spec.rateKey
      ),
      sourceIssueLayouts: issueDrops.sourceIssueLayouts || {},
      sourceOpeningComplete: issueDrops.sourceOpeningComplete || {},
      sourceOpeningPending: issueDrops.sourceOpeningPending || {},
      sourceTransferLines: issueDrops.sourceTransferLines || {},
      destinationTransferLines: transferLines(result),
    });
  }
  const payload = remapPayload(spec, result, rates);
  if (spec.kind === 'jubilee') {
    const place =
      deps.placeJubileeHillsFromPivots ||
      (await import('../services/financials.service.js')).placeJubileeHillsFromPivots;
    return place(payload);
  }
  const remap =
    deps.remapClosingStockFromPivots ||
    (await import('../services/financials.service.js')).remapClosingStockFromPivots;
  return remap(payload);
}

/**
 * Rebuild receipt amounts on every processed branch using Average Rates that
 * are already independent of opening mapping (or just became mapped).
 *
 * @param {string} currentRateBranch
 * @param {object} currentResult
 * @param {{
 *   loadBranchResult?: (sessionKey: string) => Promise<object|null>,
 *   persistBranchResult?: (sessionKey: string, result: object) => Promise<void>,
 *   remapClosingStockFromPivots?: Function,
 *   placeJubileeHillsFromPivots?: Function,
 * }} [deps]
 */
export async function maybeFillCrossBranchReceiptAmounts(
  currentRateBranch,
  currentResult,
  deps = {}
) {
  const rateKey = receiptRateBranchKey(currentRateBranch);
  if (!hasPivots(currentResult)) return currentResult;

  const loadBranch = deps.loadBranchResult || defaultLoadBranchResult;
  const persistBranch = deps.persistBranchResult || defaultPersistBranchResult;
  const results = { [rateKey]: currentResult };

  for (const spec of BRANCH_SPECS) {
    if (spec.rateKey === rateKey) continue;
    const loaded = await loadBranch(spec.sessionKey);
    if (hasPivots(loaded)) results[spec.rateKey] = loaded;
  }

  const ready = readyAverageRates(currentResult);
  if (ready.length) saveBranchAverageRates(rateKey, ready);

  let rates = collectRates(results);
  for (let pass = 0; pass < 2; pass += 1) {
    const issueDrops = collectIssueDrops(results);
    for (const spec of BRANCH_SPECS) {
      if (!results[spec.rateKey]) continue;
      const nextPayload = await remapBranch(spec, results[spec.rateKey], rates, deps, issueDrops);
      const filled = applyFill(results[spec.rateKey], nextPayload);
      results[spec.rateKey] = filled;
      const nextRates = readyAverageRates(filled);
      if (nextRates.length) {
        rates[spec.rateKey] = nextRates;
        saveBranchAverageRates(spec.rateKey, nextRates);
      }
    }
  }

  for (const spec of BRANCH_SPECS) {
    if (spec.rateKey === rateKey || !results[spec.rateKey]) continue;
    await persistBranch(spec.sessionKey, results[spec.rateKey]);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(FINANCIALS_RECEIPT_RATES_EVENT));
  }

  return results[rateKey];
}

/**
 * Fill this branch's receipt amounts from Average Rates already stored on any
 * processed Financials branch. Used by the Basheerbagh/Kokapet preview remap
 * so Jubilee Hills/Kokapet rates are not wiped when the sheet is rebuilt.
 */
export async function buildCrossBranchExportFields(destinationBranch, destResult, deps = {}) {
  const rateKey = receiptRateBranchKey(destinationBranch);
  const loadBranch = deps.loadBranchResult || defaultLoadBranchResult;
  const results = { [rateKey]: destResult };
  for (const spec of BRANCH_SPECS) {
    if (spec.rateKey === rateKey) continue;
    const loaded = await loadBranch(spec.sessionKey);
    if (hasPivots(loaded)) results[spec.rateKey] = loaded;
  }
  const ready = readyAverageRates(destResult);
  if (ready.length) saveBranchAverageRates(rateKey, ready);
  const drops = collectIssueDrops(results);
  return {
    layoutByCategory: destResult?.layoutByCategory || {},
    sourceAverageRates: collectRates(results),
    receiptRateMappings: readReceiptRateMappings(
      rateKey === 'jubileeHills' ? 'jubilee-hills' : rateKey
    ),
    sourceIssueLayouts: drops.sourceIssueLayouts,
    sourceOpeningComplete: drops.sourceOpeningComplete,
    sourceOpeningPending: drops.sourceOpeningPending,
    sourceTransferLines: drops.sourceTransferLines,
    destinationTransferLines: transferLines(destResult),
  };
}

export async function applyReadyReceiptRates(currentRateBranch, currentResult, deps = {}) {
  const rateKey = receiptRateBranchKey(currentRateBranch);
  if (!hasPivots(currentResult)) return currentResult;

  const loadBranch = deps.loadBranchResult || defaultLoadBranchResult;
  const results = { [rateKey]: currentResult };
  for (const spec of BRANCH_SPECS) {
    if (spec.rateKey === rateKey) continue;
    const loaded = await loadBranch(spec.sessionKey);
    if (hasPivots(loaded)) results[spec.rateKey] = loaded;
  }

  const ready = readyAverageRates(currentResult);
  if (ready.length) saveBranchAverageRates(rateKey, ready);

  const spec = BRANCH_SPECS.find((item) => item.rateKey === rateKey);
  const payload = await remapBranch(
    spec,
    currentResult,
    collectRates(results),
    deps,
    collectIssueDrops(results)
  );
  return applyFill(currentResult, payload);
}

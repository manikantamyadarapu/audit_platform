import {
  bootstrapAuditSessionState,
  loadAuditSessionOverflow,
} from './auditSessionStorage';

export const CONSOLIDATED_BRANCH_SESSIONS = Object.freeze({
  basheerbagh: 'financials-sales-purchases',
  kokapet: 'financials-kokapet',
  jubileeHills: 'financials-jubilee-hills',
});

export const CONSOLIDATED_BRANCH_LABELS = Object.freeze({
  basheerbagh: 'Basheerbagh',
  kokapet: 'Kokapet',
  jubileeHills: 'Jubilee Hills',
});

function hasBranchSources(result) {
  if (!result || typeof result !== 'object') return false;
  if (result.layoutByCategory && Object.keys(result.layoutByCategory).length) return true;
  if (Array.isArray(result.salesPivot) && result.salesPivot.length) return true;
  if (Array.isArray(result.netSalesPivot) && result.netSalesPivot.length) return true;
  if (Array.isArray(result.purchasesPivot) && result.purchasesPivot.length) return true;
  if (Array.isArray(result.openingPivot) && result.openingPivot.length) return true;
  return false;
}

function branchTemplatePayload(result) {
  if (!hasBranchSources(result)) return null;
  return {
    layoutByCategory: result.layoutByCategory || {},
    salesPivot: result.netSalesPivot?.length ? result.netSalesPivot : result.salesPivot || [],
    purchasesPivot: result.netPurchasesPivot?.length
      ? result.netPurchasesPivot
      : result.purchasesPivot || [],
    openingPivot: result.openingPivot || [],
    mrPivots: result.mrPivots || result.transferPivots?.mrPivots || {},
    dcPivots: result.dcPivots || result.transferPivots?.dcPivots || {},
  };
}

async function loadBranchResult(sessionKey) {
  const local = bootstrapAuditSessionState(sessionKey)?.data?.result;
  if (hasBranchSources(local)) return local;
  try {
    const overflow = await loadAuditSessionOverflow(sessionKey);
    const overflowResult = overflow?.data?.result;
    if (hasBranchSources(overflowResult)) return overflowResult;
  } catch {
    /* IndexedDB unavailable */
  }
  return local || null;
}

/** Completed Financials snapshots from the three branch pages (browser session). */
export async function loadConsolidatedBranchPayloads() {
  const branches = {};
  const missing = [];
  for (const [branch, sessionKey] of Object.entries(CONSOLIDATED_BRANCH_SESSIONS)) {
    const payload = branchTemplatePayload(await loadBranchResult(sessionKey));
    if (payload) branches[branch] = payload;
    else missing.push(branch);
  }
  return { branches, missing };
}

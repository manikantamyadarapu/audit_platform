/** Preload audit page chunks on sidebar hover for faster navigation. */
const AUDIT_ROUTE_PRELOADERS = {
  '/scrutiny/pan': () => import('../pages/PanVerification'),
  '/scrutiny/gross-weight': () => import('../pages/GrossWeight'),
  '/scrutiny/sales-ledger': () => import('../pages/SalesLedger'),
  '/scrutiny/sales-return-rate': () => import('../pages/SalesReturnRateAudit'),
  '/scrutiny/rate-rule-book': () => import('../pages/RateRuleBook'),
  '/scrutiny/diamond-gem-rates': () => import('../pages/DiamondGemRateBook'),
};

const preloaded = new Set();

export function preloadAuditRoute(path) {
  const loader = AUDIT_ROUTE_PRELOADERS[path];
  if (!loader || preloaded.has(path)) return;
  preloaded.add(path);
  loader().catch(() => {
    preloaded.delete(path);
  });
}

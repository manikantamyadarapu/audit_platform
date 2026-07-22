/** Preload audit page chunks on sidebar hover for faster navigation. */
const AUDIT_ROUTE_PRELOADERS = {
  '/scrutiny/pan': () => import('../pages/PanVerification'),
  '/scrutiny/gross-weight': () => import('../pages/GrossWeight'),
  '/scrutiny/purchase/gross-weight': () => import('../pages/PurchaseGrossWeight'),
  '/scrutiny/sales-ledger': () => import('../pages/SalesPage'),
  '/scrutiny/purchase/rate-ledger': () => import('../pages/PurchasePage'),
  '/scrutiny/sales-return-rate': () => import('../pages/SalesReturnPage'),
  '/scrutiny/purchase/return-rate': () => import('../pages/PurchaseReturnPage'),
  '/scrutiny/rate-rule-book': () => import('../pages/RateRuleBook'),
  '/scrutiny/cash-ledger': () => import('../pages/CashLedgerPage'),
  '/scrutiny/negative-bank': () => import('../pages/NegativeBankPage'),
  '/scrutiny/tds/party-wise-summary': () => import('../pages/PartyWiseTdsSummaryPage'),
  '/scrutiny/tds/rate-0.1': () => import('../pages/TdsRate01Page'),
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

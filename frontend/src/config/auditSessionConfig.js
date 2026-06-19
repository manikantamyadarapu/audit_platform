/**
 * Registry mapping audit workspaces to routes and browser storage keys.
 * Each audit type has a fully independent saved workspace (localStorage only).
 * localStorage key: audit_session_{userId}_{suffix}
 */
export const AUDIT_SESSION_REGISTRY = {
  'sales-ledger': {
    pageRoute: '/scrutiny/sales-ledger',
    localStorageAlias: 'audit_session_sales',
  },
  'sales-return-audit': {
    pageRoute: '/scrutiny/sales-return-rate',
    localStorageAlias: 'audit_session_sales_return',
  },
  'gross-weight': {
    pageRoute: '/scrutiny/gross-weight',
    localStorageAlias: 'audit_session_gross',
  },
  'pan-audit': {
    pageRoute: '/scrutiny/pan',
    localStorageAlias: 'audit_session_pan',
  },
  'rate-rule-book': {
    pageRoute: '/scrutiny/rate-rule-book',
    localStorageAlias: 'audit_session_rate',
  },
};

/** @param {string} registryKey */
export function getAuditSessionConfig(registryKey) {
  return AUDIT_SESSION_REGISTRY[registryKey] ?? null;
}

/** Resolve audit workspace config from current route pathname. */
export function getAuditSessionConfigByRoute(pathname) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const entry = Object.entries(AUDIT_SESSION_REGISTRY).find(
    ([, config]) => normalized === config.pageRoute || normalized.startsWith(`${config.pageRoute}/`)
  );
  if (!entry) return null;
  return { registryKey: entry[0], ...entry[1] };
}

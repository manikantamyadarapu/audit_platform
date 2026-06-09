/**
 * Registry mapping audit workspaces to audit type codes, routes, and storage keys.
 * Each audit type has a fully independent saved workspace.
 * Backend session key: USER_{userId}_{auditCode}
 * localStorage key: audit_session_{userId}_{suffix}
 */
export const AUDIT_SESSION_REGISTRY = {
  'sales-ledger': {
    auditCode: 'SALES',
    pageRoute: '/scrutiny/sales-ledger',
    localStorageAlias: 'audit_session_sales',
  },
  'sales-return-audit': {
    auditCode: 'SALES_RETURN',
    pageRoute: '/scrutiny/sales-return-rate',
    localStorageAlias: 'audit_session_sales_return',
  },
  'gross-weight': {
    auditCode: 'GROSS',
    pageRoute: '/scrutiny/gross-weight',
    localStorageAlias: 'audit_session_gross',
  },
  'pan-audit': {
    auditCode: 'PAN',
    pageRoute: '/scrutiny/pan',
    localStorageAlias: 'audit_session_pan',
  },
  'rate-rule-book': {
    auditCode: 'RATE',
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

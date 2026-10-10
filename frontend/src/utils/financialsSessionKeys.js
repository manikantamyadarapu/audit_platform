/** Closing-stock Financials branches that share Jubilee's sheet/pivot payload shape. */
export const FINANCIALS_SESSION_KEYS = Object.freeze([
  'financials-sales-purchases',
  'financials-kokapet',
  'financials-jubilee-hills',
]);

export function isFinancialsSessionKey(registryKey) {
  return FINANCIALS_SESSION_KEYS.includes(registryKey);
}

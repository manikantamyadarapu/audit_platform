import { RULE_BOOK_PRODUCTS } from '../constants/metalRateRuleBook';

function parseRateValue(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {boolean}
 */
export function hasConfiguredRateRules(data) {
  if (!data?.updated_at) return false;

  const rates = data.rates ?? data ?? {};
  return RULE_BOOK_PRODUCTS.some((product) => {
    const value = rates[product];
    if (value && typeof value === 'object') {
      return (
        parseRateValue(value.min_rate) != null || parseRateValue(value.max_rate) != null
      );
    }
    return parseRateValue(value) != null;
  });
}

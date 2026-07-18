import api, { getApiErrorMessage } from './api';

/**
 * @returns {Promise<{
 *   rules: Record<string, { description: string | null, threshold: string | null, rate: string | null, rate_individual: string | null, rate_others: string | null, special_rule: string | null }>,
 *   updated_at: string | null,
 * }>}
 */
export async function fetchTdsRules(signal) {
  const { data } = await api.get('/api/v1/tds-rules', { signal });
  return data;
}

/**
 * @param {{ rules: Record<string, { description: string | null, threshold: string | null, rate: string | null, rate_individual: string | null, rate_others: string | null, special_rule: string | null }> }} payload
 */
export async function saveTdsRules(payload, signal) {
  try {
    const { data } = await api.post('/api/v1/tds-rules', payload, { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

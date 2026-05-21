import api, { getApiErrorMessage } from './api';

/**
 * @returns {Promise<{
 *   rates: Record<string, number | null>,
 *   allowed_variation_percent: number,
 *   updated_at: string | null,
 * }>}
 */
export async function fetchRateRules(signal) {
  const { data } = await api.get('/api/v1/rate-rules', { signal });
  return data;
}

/**
 * @param {{ rates: Record<string, number | null>, allowed_variation_percent?: number }} payload
 */
export async function saveRateRules(payload, signal) {
  try {
    const { data } = await api.post('/api/v1/rate-rules', payload, { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

import api, { getApiErrorMessage } from './api';

/**
 * @returns {Promise<{
 *   products: Record<string, { min_rate: number | null, max_rate: number | null }>,
 *   uplift_percent: number,
 *   deviation_percent: number,
 *   updated_at: string | null,
 * }>}
 */
export async function fetchDiamondRateRules(signal) {
  const { data } = await api.get('/api/v1/diamond-rate-rules', { signal });
  return data;
}

/**
 * @param {{
 *   products: Record<string, { min_rate?: number | null, max_rate?: number | null }>,
 *   uplift_percent?: number,
 *   deviation_percent?: number,
 * }} payload
 */
export async function saveDiamondRateRules(payload, signal) {
  try {
    const { data } = await api.post('/api/v1/diamond-rate-rules', payload, { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

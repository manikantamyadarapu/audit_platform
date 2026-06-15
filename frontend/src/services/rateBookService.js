import api, { getApiErrorMessage } from './api';

/**
 * @returns {Promise<{
 *   success: boolean,
 *   products: Record<string, { min_rate?: number | null, max_rate?: number | null, min_only?: boolean }>,
 *   uplift_percent: number,
 *   deviation_percent: number,
 *   updated_at?: string | null,
 * }>}
 */
export async function fetchDiamondRateBook(signal) {
  try {
    const { data } = await api.get('/api/v1/rate-book/diamonds', { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

/**
 * @param {{
 *   products: Record<string, unknown>,
 *   uplift_percent: number,
 *   deviation_percent: number,
 * }} payload
 */
export async function saveDiamondRateBook(payload, signal) {
  try {
    const { data } = await api.post('/api/v1/rate-book/diamonds', payload, { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

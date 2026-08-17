import apiClient, { getApiErrorMessage } from './apiClient';

/**
 * @returns {Promise<{
 *   rates: Record<string, number | null>,
 *   allowed_variation_percent: number,
 *   updated_at: string | null,
 * }>}
 */
export async function fetchRateRules(signal) {
  const { data } = await apiClient.get('/api/v1/rate-rules', { signal });
  return data;
}

/**
 * @param {{ rates: Record<string, number | null>, allowed_variation_percent?: number }} payload
 */
export async function saveRateRules(payload, signal) {
  try {
    const { data } = await apiClient.post('/api/v1/rate-rules', payload, { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err), { cause: err });
  }
}

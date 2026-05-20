import api, { getApiErrorMessage } from './api';

/**
 * @returns {Promise<{
 *   gold_14k_rate: number | null,
 *   gold_18k_rate: number | null,
 *   gold_22k_rate: number | null,
 *   gold_jadau_rate: number | null,
 *   gold_24k_rate: number | null,
 *   silver_rate: number | null,
 *   allowed_variation_percent: number,
 *   updated_at: string | null,
 * }>}
 */
export async function fetchRateRules(signal) {
  const { data } = await api.get('/api/v1/rate-rules', { signal });
  return data;
}

/**
 * @param {{
 *   gold_14k_rate?: number | null,
 *   gold_18k_rate?: number | null,
 *   gold_22k_rate?: number | null,
 *   gold_jadau_rate?: number | null,
 *   gold_24k_rate?: number | null,
 *   silver_rate?: number | null,
 * }} payload
 */
export async function saveRateRules(payload, signal) {
  try {
    const { data } = await api.post('/api/v1/rate-rules', payload, { signal });
    return data;
  } catch (err) {
    throw new Error(getApiErrorMessage(err));
  }
}

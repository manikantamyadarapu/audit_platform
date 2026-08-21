import apiClient from './apiClient';
import { getAuthToken } from '../utils/authUser';

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @returns {Promise<Array<{ key: string, label: string }>>}
 */
export async function fetchDemoVideoModules() {
  const { data } = await apiClient.get('/api/v1/demo-videos/modules', {
    headers: authHeaders(),
  });
  return data?.data ?? [];
}

/**
 * Active videos for any signed-in role.
 * @returns {Promise<object[]>}
 */
export async function fetchActiveDemoVideos() {
  const { data } = await apiClient.get('/api/v1/demo-videos/active', {
    headers: authHeaders(),
  });
  return data?.data ?? [];
}

/**
 * @param {string} moduleKey
 * @returns {Promise<object|null>}
 */
export async function fetchDemoVideoByModule(moduleKey) {
  try {
    const { data } = await apiClient.get(`/api/v1/demo-videos/module/${encodeURIComponent(moduleKey)}`, {
      headers: authHeaders(),
    });
    return data?.data ?? null;
  } catch (error) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

/**
 * Admin: list all videos including inactive.
 * @returns {Promise<object[]>}
 */
export async function fetchAllDemoVideos() {
  const { data } = await apiClient.get('/api/v1/demo-videos', {
    headers: authHeaders(),
  });
  return data?.data ?? [];
}

/**
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function createDemoVideo(payload) {
  const { data } = await apiClient.post('/api/v1/demo-videos', payload, {
    headers: authHeaders(),
  });
  return data?.data;
}

/**
 * @param {number} id
 * @param {object} payload
 * @returns {Promise<object>}
 */
export async function updateDemoVideo(id, payload) {
  const { data } = await apiClient.put(`/api/v1/demo-videos/${id}`, payload, {
    headers: authHeaders(),
  });
  return data?.data;
}

/**
 * Soft-deactivate.
 * @param {number} id
 * @returns {Promise<object>}
 */
export async function deactivateDemoVideo(id) {
  const { data } = await apiClient.patch(`/api/v1/demo-videos/${id}/deactivate`, null, {
    headers: authHeaders(),
  });
  return data?.data;
}

/**
 * Hard delete.
 * @param {number} id
 * @returns {Promise<object>}
 */
export async function deleteDemoVideo(id) {
  const { data } = await apiClient.delete(`/api/v1/demo-videos/${id}`, {
    headers: authHeaders(),
  });
  return data?.data;
}

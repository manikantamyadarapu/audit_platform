import api from './api';
import { getAuthToken } from '../utils/authUser';

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * @returns {Promise<{ items: object[], unreadCount: number } | null>}
 */
export async function fetchNotifications({ limit = 30, unreadOnly = false } = {}) {
  const token = getAuthToken();
  if (!token) return null;

  const { data } = await api.get('/api/notifications', {
    params: { limit, unreadOnly },
    headers: authHeaders(),
  });

  return data?.data ?? { items: [], unreadCount: 0 };
}

/**
 * @param {number} notificationId
 */
export async function markNotificationRead(notificationId) {
  const token = getAuthToken();
  if (!token) return null;

  const { data } = await api.patch(`/api/notifications/${notificationId}/read`, null, {
    headers: authHeaders(),
  });

  return data?.data ?? null;
}

export async function markAllNotificationsRead() {
  const token = getAuthToken();
  if (!token) return null;

  const { data } = await api.post('/api/notifications/read-all', null, {
    headers: authHeaders(),
  });

  return data?.data ?? null;
}

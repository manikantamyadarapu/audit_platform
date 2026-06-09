import api from './api';
import { getAuthToken } from '../utils/authUser';

function authHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Restore persisted audit session from the database.
 * @param {{ auditTypeId?: number, auditCode?: string }} params
 */
export async function restoreAuditSession(params) {
  const token = getAuthToken();
  if (!token) return null;

  const query = params.auditTypeId
    ? { auditTypeId: params.auditTypeId }
    : { auditCode: params.auditCode };

  const { data } = await api.get('/api/audit-sessions/restore', {
    params: query,
    headers: authHeaders(),
  });

  return data;
}

/**
 * Save audit session to the database.
 * @param {object} payload
 */
export async function saveAuditSessionRemote(payload) {
  const token = getAuthToken();
  if (!token) return null;

  const { data } = await api.post('/api/audit-sessions/save', payload, {
    headers: authHeaders(),
  });

  return data;
}

/**
 * Clear (deactivate) audit session on the server.
 * @param {{ auditTypeId?: number, auditCode?: string }} params
 */
export async function clearAuditSessionRemote(params) {
  const token = getAuthToken();
  if (!token) return null;

  const query = params.auditTypeId
    ? { auditTypeId: params.auditTypeId }
    : { auditCode: params.auditCode };

  const { data } = await api.delete('/api/audit-sessions/clear', {
    params: query,
    headers: authHeaders(),
  });

  return data;
}

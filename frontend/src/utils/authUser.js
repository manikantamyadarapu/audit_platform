/**
 * Read and refresh the logged-in user from localStorage / auth API.
 */

const ACCESS_TOKEN_KEY = 'accessToken';
const LEGACY_TOKEN_KEY = 'token';

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
}

/** @deprecated Use getAccessToken */
export function getAuthToken() {
  return getAccessToken();
}

export function setAccessToken(token) {
  if (!token) return;
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getUserInitials(name) {
  const text = String(name || '').trim();
  if (!text) return 'U';
  return text
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function persistUser(user) {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }
}

export function clearAuthSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem('user');
  localStorage.removeItem('isAuthenticated');
}

/**
 * Exchange HttpOnly refresh cookie for a new access token.
 * @returns {Promise<string | null>}
 */
export async function refreshAccessToken() {
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return null;
  }

  const token = data.accessToken || data.token || null;
  if (token) {
    setAccessToken(token);
    localStorage.setItem('isAuthenticated', 'true');
  }
  return token;
}

/**
 * Revoke refresh session server-side and clear local access token state.
 */
export async function logoutUser() {
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      },
    });
  } catch {
    // Always clear local session even if network fails.
  }
  clearAuthSession();
}

/**
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchCurrentUser() {
  let token = getAccessToken();
  if (!token) return null;

  const requestMe = (accessToken) =>
    fetch('/api/v1/auth/me', {
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

  let response = await requestMe(token);

  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearAuthSession();
      return null;
    }
    token = refreshed;
    response = await requestMe(token);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.detail || 'Failed to load profile');
  }

  const user = data.user ?? null;
  if (user) persistUser(user);
  return user;
}

export function formatRoleLabel(role) {
  if (!role) return '—';
  return String(role).replace(/_/g, ' ');
}

import { API_BASE_URL } from '../config/api';

const AUTH_TOKEN_KEY = 'accessToken';
const LEGACY_AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'user';
const AUTH_FLAG_KEY = 'isAuthenticated';
const REMEMBER_ME_KEY = 'rememberMe';
const REMEMBER_EMAIL_KEY = 'rememberedEmail';

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function getActiveStorage() {
  const local = getLocalStorage();
  if (local?.getItem(AUTH_TOKEN_KEY) || local?.getItem(LEGACY_AUTH_TOKEN_KEY)) return local;
  return getSessionStorage();
}

export function getRememberMePreference() {
  return getLocalStorage()?.getItem(REMEMBER_ME_KEY) === 'true';
}

export function getRememberedEmail() {
  if (!getRememberMePreference()) return '';
  return getLocalStorage()?.getItem(REMEMBER_EMAIL_KEY) || '';
}

export function persistAuthSession({ accessToken, token, user, rememberMe, email }) {
  const local = getLocalStorage();
  const session = getSessionStorage();
  if (!local || !session) return;

  const resolvedToken = accessToken || token;
  const payload = {
    token: resolvedToken,
    user: JSON.stringify(user),
    isAuthenticated: 'true',
  };

  if (rememberMe) {
    local.setItem(AUTH_TOKEN_KEY, payload.token);
    local.removeItem(LEGACY_AUTH_TOKEN_KEY);
    local.setItem(AUTH_USER_KEY, payload.user);
    local.setItem(AUTH_FLAG_KEY, payload.isAuthenticated);
    local.setItem(REMEMBER_ME_KEY, 'true');
    if (email) local.setItem(REMEMBER_EMAIL_KEY, email);

    session.removeItem(AUTH_TOKEN_KEY);
    session.removeItem(LEGACY_AUTH_TOKEN_KEY);
    session.removeItem(AUTH_USER_KEY);
    session.removeItem(AUTH_FLAG_KEY);
    return;
  }

  session.setItem(AUTH_TOKEN_KEY, payload.token);
  session.removeItem(LEGACY_AUTH_TOKEN_KEY);
  session.setItem(AUTH_USER_KEY, payload.user);
  session.setItem(AUTH_FLAG_KEY, payload.isAuthenticated);

  local.removeItem(AUTH_TOKEN_KEY);
  local.removeItem(LEGACY_AUTH_TOKEN_KEY);
  local.removeItem(AUTH_USER_KEY);
  local.removeItem(AUTH_FLAG_KEY);
  local.removeItem(REMEMBER_ME_KEY);
  local.removeItem(REMEMBER_EMAIL_KEY);
}

export function persistAccessToken(token) {
  const storage = getActiveStorage() || getSessionStorage();
  if (!storage || !token) return;
  storage.setItem(AUTH_TOKEN_KEY, token);
  storage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

export function getStoredUser() {
  try {
    const raw =
      getActiveStorage()?.getItem(AUTH_USER_KEY) ||
      getLocalStorage()?.getItem(AUTH_USER_KEY) ||
      getSessionStorage()?.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return (
    getActiveStorage()?.getItem(AUTH_TOKEN_KEY) ||
    getActiveStorage()?.getItem(LEGACY_AUTH_TOKEN_KEY) ||
    getLocalStorage()?.getItem(AUTH_TOKEN_KEY) ||
    getLocalStorage()?.getItem(LEGACY_AUTH_TOKEN_KEY) ||
    getSessionStorage()?.getItem(AUTH_TOKEN_KEY) ||
    getSessionStorage()?.getItem(LEGACY_AUTH_TOKEN_KEY)
  );
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
  const storage = getActiveStorage() || getLocalStorage();
  if (user && storage) {
    storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  const local = getLocalStorage();
  const session = getSessionStorage();

  local?.removeItem(AUTH_TOKEN_KEY);
  local?.removeItem(LEGACY_AUTH_TOKEN_KEY);
  local?.removeItem(AUTH_USER_KEY);
  local?.removeItem(AUTH_FLAG_KEY);

  session?.removeItem(AUTH_TOKEN_KEY);
  session?.removeItem(LEGACY_AUTH_TOKEN_KEY);
  session?.removeItem(AUTH_USER_KEY);
  session?.removeItem(AUTH_FLAG_KEY);
}

const PUBLIC_PATH_PREFIXES = ['/login', '/forgot-password', '/reset-password'];

export function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname;
  if (PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return;
  clearAuthSession();
  const redirect = path && path !== '/' ? `?redirect=${encodeURIComponent(path)}` : '';
  window.location.href = `/login${redirect}`;
}

/**
 * Exchange HttpOnly refresh cookie for a new access token.
 * @returns {Promise<string | null>}
 */
export async function tryRefreshAccessToken() {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) return null;

  const data = await response.json().catch(() => ({}));
  const token = data?.accessToken;
  if (!token) return null;

  persistAccessToken(token);
  return token;
}

/**
 * Validate session on app load: access token → /me, refresh on failure.
 * @returns {Promise<boolean>}
 */
export async function bootstrapAuthSession() {
  if (!getAuthToken()) {
    const token = await tryRefreshAccessToken();
    if (!token) return false;
  }

  try {
    await fetchCurrentUser();
    return true;
  } catch {
    const token = await tryRefreshAccessToken();
    if (!token) {
      clearAuthSession();
      return false;
    }

    try {
      await fetchCurrentUser();
      return true;
    } catch {
      clearAuthSession();
      return false;
    }
  }
}

/**
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

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

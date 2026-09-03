import { API_BASE_URL } from '../config/api';

const AUTH_TOKEN_KEY = 'accessToken';
const LEGACY_AUTH_TOKEN_KEY = 'token';
const AUTH_USER_KEY = 'user';
const AUTH_FLAG_KEY = 'isAuthenticated';
const REMEMBER_ME_KEY = 'rememberMe';
const REMEMBER_EMAIL_KEY = 'rememberedEmail';

/** In-memory access JWT only — never persist bearer tokens in web storage (XSS). */
let memoryAccessToken = null;

function getSessionStorage() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function clearLegacyTokenStorage() {
  const local = getLocalStorage();
  const session = getSessionStorage();
  for (const storage of [local, session]) {
    storage?.removeItem(AUTH_TOKEN_KEY);
    storage?.removeItem(LEGACY_AUTH_TOKEN_KEY);
  }
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

  const resolvedToken = accessToken || token || null;
  memoryAccessToken = resolvedToken;
  clearLegacyTokenStorage();

  const userJson = user ? JSON.stringify(user) : null;

  if (rememberMe) {
    local.setItem(REMEMBER_ME_KEY, 'true');
    if (email) local.setItem(REMEMBER_EMAIL_KEY, email);
    if (userJson) {
      session.setItem(AUTH_USER_KEY, userJson);
      session.setItem(AUTH_FLAG_KEY, 'true');
    }
    local.removeItem(AUTH_USER_KEY);
    local.removeItem(AUTH_FLAG_KEY);
    return;
  }

  if (userJson) {
    session.setItem(AUTH_USER_KEY, userJson);
    session.setItem(AUTH_FLAG_KEY, 'true');
  }
  local.removeItem(REMEMBER_ME_KEY);
  local.removeItem(REMEMBER_EMAIL_KEY);
  local.removeItem(AUTH_USER_KEY);
  local.removeItem(AUTH_FLAG_KEY);
}

export function persistAccessToken(token) {
  memoryAccessToken = token || null;
  clearLegacyTokenStorage();
}

export function getStoredUser() {
  try {
    const raw =
      getSessionStorage()?.getItem(AUTH_USER_KEY) ||
      getLocalStorage()?.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAuthToken() {
  if (memoryAccessToken) return memoryAccessToken;
  // One-time migration: lift any legacy stored token into memory, then wipe storage.
  const legacy =
    getLocalStorage()?.getItem(AUTH_TOKEN_KEY) ||
    getLocalStorage()?.getItem(LEGACY_AUTH_TOKEN_KEY) ||
    getSessionStorage()?.getItem(AUTH_TOKEN_KEY) ||
    getSessionStorage()?.getItem(LEGACY_AUTH_TOKEN_KEY);
  if (legacy) {
    memoryAccessToken = legacy;
    clearLegacyTokenStorage();
    return memoryAccessToken;
  }
  return null;
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
  const session = getSessionStorage();
  if (user && session) {
    session.setItem(AUTH_USER_KEY, JSON.stringify(user));
    session.setItem(AUTH_FLAG_KEY, 'true');
  }
}

export function clearAuthSession() {
  memoryAccessToken = null;
  clearLegacyTokenStorage();
  const local = getLocalStorage();
  const session = getSessionStorage();
  local?.removeItem(AUTH_USER_KEY);
  local?.removeItem(AUTH_FLAG_KEY);
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

/** Safe in-app redirect path (blocks open redirects). */
export function sanitizeAppRedirect(raw) {
  if (!raw || typeof raw !== 'string') return '/dashboard';
  const path = raw.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/dashboard';
  }
  if (PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return '/dashboard';
  }
  return path;
}

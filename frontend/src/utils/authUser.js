const AUTH_TOKEN_KEY = 'token';
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
  if (local?.getItem(AUTH_TOKEN_KEY)) return local;
  return getSessionStorage();
}

export function getRememberMePreference() {
  return getLocalStorage()?.getItem(REMEMBER_ME_KEY) === 'true';
}

export function getRememberedEmail() {
  if (!getRememberMePreference()) return '';
  return getLocalStorage()?.getItem(REMEMBER_EMAIL_KEY) || '';
}

export function persistAuthSession({ token, user, rememberMe, email }) {
  const local = getLocalStorage();
  const session = getSessionStorage();
  if (!local || !session) return;

  const payload = {
    token,
    user: JSON.stringify(user),
    isAuthenticated: 'true',
  };

  if (rememberMe) {
    local.setItem(AUTH_TOKEN_KEY, payload.token);
    local.setItem(AUTH_USER_KEY, payload.user);
    local.setItem(AUTH_FLAG_KEY, payload.isAuthenticated);
    local.setItem(REMEMBER_ME_KEY, 'true');
    if (email) local.setItem(REMEMBER_EMAIL_KEY, email);

    session.removeItem(AUTH_TOKEN_KEY);
    session.removeItem(AUTH_USER_KEY);
    session.removeItem(AUTH_FLAG_KEY);
    return;
  }

  session.setItem(AUTH_TOKEN_KEY, payload.token);
  session.setItem(AUTH_USER_KEY, payload.user);
  session.setItem(AUTH_FLAG_KEY, payload.isAuthenticated);

  local.removeItem(AUTH_TOKEN_KEY);
  local.removeItem(AUTH_USER_KEY);
  local.removeItem(AUTH_FLAG_KEY);
  local.removeItem(REMEMBER_ME_KEY);
  local.removeItem(REMEMBER_EMAIL_KEY);
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
    getLocalStorage()?.getItem(AUTH_TOKEN_KEY) ||
    getSessionStorage()?.getItem(AUTH_TOKEN_KEY)
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
  local?.removeItem(AUTH_USER_KEY);
  local?.removeItem(AUTH_FLAG_KEY);

  session?.removeItem(AUTH_TOKEN_KEY);
  session?.removeItem(AUTH_USER_KEY);
  session?.removeItem(AUTH_FLAG_KEY);
}

/**
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchCurrentUser() {
  const token = getAuthToken();
  if (!token) return null;

  const response = await fetch('/api/v1/auth/me', {
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

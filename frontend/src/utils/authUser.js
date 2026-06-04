/**
 * Read and refresh the logged-in user from localStorage / auth API.
 */

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAuthToken() {
  return localStorage.getItem('token');
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
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('isAuthenticated');
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

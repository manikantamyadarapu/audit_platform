import { API_BASE_URL } from '../config/api';

async function parseJsonResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.detail || response.statusText || 'Request failed');
  }
  return data;
}

export async function loginRequest({ email, password }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseJsonResponse(response);
}

export async function logoutRequest() {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  return parseJsonResponse(response);
}

export async function forgotPasswordRequest(email) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return parseJsonResponse(response);
}

export async function validateResetTokenRequest(token) {
  const response = await fetch(
    `${API_BASE_URL}/api/v1/auth/reset-password/validate?token=${encodeURIComponent(token)}`
  );
  return parseJsonResponse(response);
}

export async function resetPasswordRequest({ token, newPassword }) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  return parseJsonResponse(response);
}

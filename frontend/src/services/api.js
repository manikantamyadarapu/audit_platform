import axios from 'axios';
import {
  getAuthToken,
  redirectToLogin,
  tryRefreshAccessToken,
} from '../utils/authUser';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

const parsedTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const apiTimeout =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 900_000;

const api = axios.create({
  baseURL,
  timeout: apiTimeout,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

let refreshPromise = null;

const AUTH_REFRESH_PATH = '/api/auth/refresh';
const AUTH_LOGIN_PATH = '/api/auth/login';

function shouldSkipRefresh(config) {
  const url = config?.url || '';
  return (
    url.includes(AUTH_REFRESH_PATH) ||
    url.includes(AUTH_LOGIN_PATH) ||
    url.includes('/api/auth/logout')
  );
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      !originalRequest ||
      originalRequest._retry ||
      shouldSkipRefresh(originalRequest) ||
      error.response?.status !== 401
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = tryRefreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const nextToken = await refreshPromise;

      if (!nextToken) {
        throw new Error('Refresh failed');
      }

      originalRequest.headers.Authorization = `Bearer ${nextToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      redirectToLogin();
      return Promise.reject(refreshError);
    }
  }
);

export function getApiErrorMessage(error) {
  if (!error) return 'Something went wrong';
  if (typeof error === 'string') return error;
  const res = error.response;
  const data = res?.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.detail === 'string') {
      if (Array.isArray(data.error?.missingColumns) && data.error.missingColumns.length) {
        return `${data.detail} (missing: ${data.error.missingColumns.join(', ')})`;
      }
      return data.detail;
    }
    if (typeof data.message === 'string') return data.message;
  }
  if (typeof data === 'string') return data;
  if (error.message) return error.message;
  return 'Request failed';
}

export default api;

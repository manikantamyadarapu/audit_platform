import axios from 'axios';
import { clearAuthSession, getAccessToken, refreshAccessToken } from '../utils/authUser';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

const api = axios.create({
  baseURL,
  timeout: 600_000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

let refreshPromise = null;

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config || config._authRetry) {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const url = String(config.url || '');
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout');

    if (status === 401 && !isAuthRoute) {
      config._authRetry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const newToken = await refreshPromise;
        if (!newToken) {
          clearAuthSession();
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            window.location.assign('/login');
          }
          return Promise.reject(error);
        }

        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      } catch (refreshError) {
        clearAuthSession();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.assign('/login');
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
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

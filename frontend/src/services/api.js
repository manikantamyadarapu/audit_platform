import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

const parsedTimeout = Number(import.meta.env.VITE_API_TIMEOUT_MS);
const apiTimeout =
  Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 900_000;

const api = axios.create({
  baseURL,
  timeout: apiTimeout,
  headers: {
    Accept: 'application/json',
  },
});

export function getApiErrorMessage(error) {
  if (!error) return 'Something went wrong';
  if (typeof error === 'string') return error;
  const res = error.response;
  const data = res?.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.message === 'string') return data.message;
  }
  if (typeof data === 'string') return data;
  if (error.message) return error.message;
  return 'Request failed';
}

export default api;

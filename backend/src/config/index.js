const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { validateEnvOrThrow } = require('./env-validation');

const PORT = Number(process.env.PORT) || 4001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000').replace(
  /\/$/,
  ''
);

/** Comma-separated origins, or "*" for all (dev only). */
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN;
const REQUEST_BODY_JSON_LIMIT = process.env.REQUEST_BODY_JSON_LIMIT || '50mb';
const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 50 * 1024 * 1024;

/** Swagger is always disabled in production regardless of env flag. */
const ENABLE_SWAGGER = isProduction ? false : process.env.ENABLE_SWAGGER !== 'false';

/** Upstream FastAPI axios timeout — large PAN/sales uploads can exceed 120s on one worker. */
const PYTHON_SERVICE_TIMEOUT_MS = Number(process.env.PYTHON_SERVICE_TIMEOUT_MS) || 600_000;

function assertValidPythonUrl() {
  try {
    const u = new URL(PYTHON_SERVICE_URL);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('PYTHON_SERVICE_URL must use http or https');
    }
  } catch (e) {
    throw new Error(`Invalid PYTHON_SERVICE_URL: ${PYTHON_SERVICE_URL}`);
  }
}

function getCorsOrigin() {
  if (!CORS_ORIGIN_RAW || CORS_ORIGIN_RAW.trim() === '*') {
    if (isProduction) {
      throw new Error('CORS_ORIGIN must be set in production (comma-separated origins, not *)');
    }
    return true;
  }
  const list = CORS_ORIGIN_RAW.split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) {
    if (isProduction) {
      throw new Error('CORS_ORIGIN must list at least one origin in production');
    }
    return true;
  }
  if (list.length === 1) return list[0];
  return list;
}

function validateConfigOrThrow() {
  validateEnvOrThrow();
  assertValidPythonUrl();
  getCorsOrigin();
}

module.exports = {
  PORT,
  NODE_ENV,
  isProduction,
  JWT_SECRET,
  REFRESH_TOKEN_SECRET,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  PYTHON_SERVICE_URL,
  PYTHON_SERVICE_TIMEOUT_MS,
  getCorsOrigin,
  REQUEST_BODY_JSON_LIMIT,
  UPLOAD_MAX_BYTES,
  ENABLE_SWAGGER,
  validateConfigOrThrow,
};

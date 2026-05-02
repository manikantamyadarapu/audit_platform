require('dotenv').config();

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

const PYTHON_SERVICE_URL = (process.env.PYTHON_SERVICE_URL || 'http://127.0.0.1:8000').replace(
  /\/$/,
  ''
);

/** Comma-separated origins, or "*" for all (dev only). */
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN;
const REQUEST_BODY_JSON_LIMIT = process.env.REQUEST_BODY_JSON_LIMIT || '50mb';
const UPLOAD_MAX_BYTES = Number(process.env.UPLOAD_MAX_BYTES) || 50 * 1024 * 1024;

/** When false, Swagger UI at /api-docs is disabled (recommended for locked-down production). */
const ENABLE_SWAGGER = process.env.ENABLE_SWAGGER !== 'false';

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
  assertValidPythonUrl();
  getCorsOrigin();
}

module.exports = {
  PORT,
  NODE_ENV,
  isProduction,
  PYTHON_SERVICE_URL,
  getCorsOrigin,
  REQUEST_BODY_JSON_LIMIT,
  UPLOAD_MAX_BYTES,
  ENABLE_SWAGGER,
  validateConfigOrThrow,
};

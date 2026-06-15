const jwt = require('jsonwebtoken');
const { parseDurationMs } = require('./tokenDuration.util');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const ACCESS_TOKEN_MAX_AGE_MS = parseDurationMs(JWT_EXPIRES_IN, 15 * 60 * 1000);

/**
 * Generate short-lived access JWT.
 * @param {{ id: number, email: string, role: string }} payload
 */
function generateAccessToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/** @deprecated Use generateAccessToken */
function generateToken(payload) {
  return generateAccessToken(payload);
}

/**
 * Verify access JWT.
 * @param {string} token
 */
function verifyAccessToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type && decoded.type !== 'access') {
    const error = new Error('Invalid access token');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return decoded;
}

/** @deprecated Use verifyAccessToken */
function verifyToken(token) {
  return verifyAccessToken(token);
}

function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateAccessToken,
  generateToken,
  verifyAccessToken,
  verifyToken,
  decodeToken,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  ACCESS_TOKEN_MAX_AGE_MS,
};

const jwt = require('jsonwebtoken');
const config = require('../config');

const JWT_ALGORITHM = 'HS256';

/**
 * Generate short-lived access JWT.
 * @param {Object} payload
 * @returns {string}
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
    algorithm: JWT_ALGORITHM,
  });
}

/**
 * Generate refresh JWT (stored in HttpOnly cookie; validated server-side via jti store).
 * @param {Object} payload
 * @returns {string}
 */
function generateRefreshToken(payload) {
  return jwt.sign({ ...payload, type: 'refresh' }, config.REFRESH_TOKEN_SECRET, {
    expiresIn: config.REFRESH_TOKEN_EXPIRES_IN,
    algorithm: JWT_ALGORITHM,
  });
}

/**
 * Verify access JWT.
 * @param {string} token
 * @returns {Object}
 */
function verifyAccessToken(token) {
  return jwt.verify(token, config.JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
}

/**
 * Verify refresh JWT.
 * @param {string} token
 * @returns {Object}
 */
function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, config.REFRESH_TOKEN_SECRET, { algorithms: [JWT_ALGORITHM] });
  if (decoded.type !== 'refresh') {
    const error = new Error('Invalid refresh token');
    error.name = 'JsonWebTokenError';
    throw error;
  }
  return decoded;
}

function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {number} payload.id - User ID
 * @param {string} payload.email - User email
 * @param {string} payload.role - User role
 * @returns {string} JWT token
 */
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Decode JWT token without verification
 * @param {string} token - JWT token
 * @returns {Object} Decoded payload
 */
function decodeToken(token) {
  return jwt.decode(token);
}

module.exports = {
  generateToken,
  verifyToken,
  decodeToken,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};

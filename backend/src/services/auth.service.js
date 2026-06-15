const crypto = require('crypto');
const userRepository = require('../repositories/user.repository');
const refreshTokenRepository = require('../repositories/refreshToken.repository');
const { generateAccessToken } = require('../utils/jwt.util');
const { comparePassword } = require('../utils/password.util');
const { parseDurationMs } = require('../utils/tokenDuration.util');

const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const REFRESH_TOKEN_MAX_AGE_MS = parseDurationMs(REFRESH_TOKEN_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createOpaqueRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function serializeUser(user) {
  const roleName = user.role?.roleName || 'VIEWER';
  const { passwordHash, role, ...userWithoutPassword } = user;
  return {
    ...userWithoutPassword,
    role: roleName,
  };
}

async function issueTokenPair(user) {
  const roleName = user.role?.roleName || 'VIEWER';
  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: roleName,
  });

  const refreshToken = createOpaqueRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);

  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return {
    accessToken,
    refreshToken,
    refreshMaxAgeMs: REFRESH_TOKEN_MAX_AGE_MS,
    user: serializeUser(user),
  };
}

/**
 * Login user
 * @param {string} email
 * @param {string} password
 */
async function login(email, password) {
  const user = await userRepository.findActiveByEmail(email);

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  return issueTokenPair(user);
}

/**
 * Refresh access token using HttpOnly refresh cookie value.
 * @param {string} refreshToken
 */
async function refresh(refreshToken) {
  if (!refreshToken) {
    const error = new Error('Refresh token required');
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashRefreshToken(refreshToken);
  const stored = await refreshTokenRepository.findValidByHash(tokenHash);

  if (!stored) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const user = await userRepository.findById(stored.userId);

  if (!user || !user.isActive) {
    await refreshTokenRepository.deleteByHash(tokenHash);
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  await refreshTokenRepository.deleteByHash(tokenHash);
  return issueTokenPair(user);
}

/**
 * Logout user and revoke refresh token.
 * @param {string | null | undefined} refreshToken
 * @param {number | null | undefined} userId
 */
async function logout(refreshToken, userId) {
  if (refreshToken) {
    await refreshTokenRepository.deleteByHash(hashRefreshToken(refreshToken));
  }
  if (userId) {
    await refreshTokenRepository.deleteAllForUser(userId);
  }
}

/**
 * Get current user by ID
 * @param {number} userId
 */
async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) return null;
  return serializeUser(user);
}

module.exports = {
  login,
  refresh,
  logout,
  getCurrentUser,
  REFRESH_TOKEN_MAX_AGE_MS,
};

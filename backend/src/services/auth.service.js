const crypto = require('crypto');
const userRepository = require('../repositories/user.repository');
const passwordResetTokenRepository = require('../repositories/passwordResetToken.repository');
const emailService = require('./email.service');
const refreshTokenStore = require('./refreshTokenStore');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  decodeToken,
} = require('../utils/jwt.util');
const { comparePassword, hashPassword } = require('../utils/password.util');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const GENERIC_RESET_MESSAGE =
  'If an account exists for that email, password reset instructions have been sent.';

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function validatePasswordStrength(password) {
  if (!password || password.length < 6) {
    const error = new Error('Password must be at least 6 characters');
    error.statusCode = 400;
    throw error;
  }
}

function buildUserResponse(user) {
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function registerRefreshSession(userId, refreshToken) {
  const decoded = decodeToken(refreshToken);
  if (!decoded?.jti || !decoded?.exp) {
    const error = new Error('Failed to issue refresh token');
    error.statusCode = 500;
    throw error;
  }
  refreshTokenStore.registerToken(decoded.jti, userId, decoded.exp * 1000);
  return refreshToken;
}

function issueTokenPair(user) {
  const jti = refreshTokenStore.createJti();

  const accessToken = generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role,
    jti,
  });

  registerRefreshSession(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: buildUserResponse(user),
  };
}

/**
 * Login user — returns access token and sets refresh token via controller cookie.
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
 * Refresh access token using HttpOnly refresh cookie.
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    const error = new Error('Refresh token required');
    error.statusCode = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  if (!decoded.jti || !refreshTokenStore.isTokenActive(decoded.jti)) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const user = await userRepository.findById(decoded.id);
  if (!user?.isActive) {
    refreshTokenStore.revokeToken(decoded.jti);
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }

  const accessToken = generateAccessToken({
    id: decoded.id,
    email: decoded.email,
    role: decoded.role,
  });

  return { accessToken };
}

/**
 * Logout — revoke refresh token server-side.
 */
async function logout(refreshToken) {
  if (!refreshToken) {
    return { message: 'Logged out' };
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.jti) {
      refreshTokenStore.revokeToken(decoded.jti);
    }
  } catch {
    // Cookie may already be invalid — still clear client cookie.
  }

  return { message: 'Logged out' };
}

/**
 * Request password reset email
 */
async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    const error = new Error('Email is required');
    error.statusCode = 400;
    throw error;
  }

  const user = await userRepository.findActiveByEmail(normalizedEmail);

  if (!user) {
    return { message: GENERIC_RESET_MESSAGE };
  }

  await passwordResetTokenRepository.invalidateUserTokens(user.id);

  const rawToken = createResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await passwordResetTokenRepository.createToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const resetUrl = emailService.buildResetPasswordUrl(rawToken);
  const emailResult = await emailService.sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl,
  });

  const response = { message: GENERIC_RESET_MESSAGE };

  if (!emailResult.sent && process.env.NODE_ENV !== 'production') {
    response.devResetUrl = resetUrl;
  }

  return response;
}

async function validateResetToken(token) {
  if (!token) {
    const error = new Error('Reset token is required');
    error.statusCode = 400;
    throw error;
  }

  const record = await passwordResetTokenRepository.findValidByTokenHash(hashResetToken(token));
  const valid = Boolean(record?.user?.isActive);

  return { valid };
}

async function resetPassword(token, newPassword) {
  if (!token) {
    const error = new Error('Reset token is required');
    error.statusCode = 400;
    throw error;
  }

  validatePasswordStrength(newPassword);

  const record = await passwordResetTokenRepository.findValidByTokenHash(hashResetToken(token));

  if (!record || !record.user?.isActive) {
    const error = new Error('Invalid or expired reset link. Please request a new one.');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePassword(record.userId, passwordHash);
  await passwordResetTokenRepository.markUsed(record.id);
  await passwordResetTokenRepository.invalidateUserTokens(record.userId);
  refreshTokenStore.revokeAllForUser(record.userId);

  return { message: 'Password reset successfully. You can now sign in.' };
}

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) return null;
  return buildUserResponse(user);
}

module.exports = {
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
  requestPasswordReset,
  validateResetToken,
  resetPassword,
};

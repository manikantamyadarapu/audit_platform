const crypto = require('crypto');
const userRepository = require('../repositories/user.repository');
const passwordResetTokenRepository = require('../repositories/passwordResetToken.repository');
const emailService = require('./email.service');
const { generateToken, JWT_EXPIRES_IN } = require('../utils/jwt.util');
const { comparePassword, hashPassword } = require('../utils/password.util');

const JWT_REMEMBER_EXPIRES_IN = process.env.JWT_REMEMBER_EXPIRES_IN || '30d';
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

/**
 * Login user
 * @param {string} email
 * @param {string} password
 * @param {boolean} [rememberMe=false]
 * @returns {Promise<{token: string, user: Object}>}
 */
async function login(email, password, rememberMe = false) {
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

  const roleName = user.role?.roleName || 'VIEWER';
  const expiresIn = rememberMe ? JWT_REMEMBER_EXPIRES_IN : JWT_EXPIRES_IN;

  const token = generateToken(
    {
      id: user.id,
      email: user.email,
      role: roleName,
    },
    expiresIn
  );

  const { passwordHash, role, ...userWithoutPassword } = user;

  return {
    token,
    user: {
      ...userWithoutPassword,
      role: roleName,
    },
  };
}

/**
 * Request password reset email
 * @param {string} email
 * @returns {Promise<{ message: string, devResetUrl?: string }>}
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

/**
 * Validate reset token without consuming it
 * @param {string} token
 * @returns {Promise<{ valid: boolean }>}
 */
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

/**
 * Reset password using token
 * @param {string} token
 * @param {string} newPassword
 */
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

  return { message: 'Password reset successfully. You can now sign in.' };
}

/**
 * Get current user by ID
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) return null;

  const roleName = user.role?.roleName || 'VIEWER';
  const { passwordHash, role, ...userWithoutPassword } = user;

  return {
    ...userWithoutPassword,
    role: roleName,
  };
}

module.exports = {
  login,
  getCurrentUser,
  requestPasswordReset,
  validateResetToken,
  resetPassword,
};

const authService = require('../services/auth.service');

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const { token, user } = await authService.login(email, password, Boolean(rememberMe));

    res.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user
 * GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    const user = await authService.getCurrentUser(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email);

    res.json({
      success: true,
      message: result.message,
      ...(result.devResetUrl ? { devResetUrl: result.devResetUrl } : {}),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validate reset token
 * GET /api/auth/reset-password/validate
 */
async function validateResetToken(req, res, next) {
  try {
    const { token } = req.query;
    const result = await authService.validateResetToken(token);

    res.json({
      success: true,
      valid: result.valid,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reset password
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  getMe,
  forgotPassword,
  validateResetToken,
  resetPassword,
};

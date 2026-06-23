const authService = require('../services/auth.service');
const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
} = require('../utils/refreshCookie.util');

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const { accessToken, refreshToken, user } = await authService.login(email, password);

    setRefreshTokenCookie(res, refreshToken);

    res.json({
      success: true,
      accessToken,
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    const { accessToken } = await authService.refreshAccessToken(refreshToken);

    res.json({
      success: true,
      accessToken,
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 401;
    }
    next(error);
  }
}

/**
 * Logout user
 * POST /api/auth/logout
 */
async function logout(req, res, next) {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    const result = await authService.logout(refreshToken);
    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
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
  refresh,
  logout,
  getMe,
  forgotPassword,
  validateResetToken,
  resetPassword,
};

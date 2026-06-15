const authService = require('../services/auth.service');
const {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
} = require('../utils/cookie.util');

/**
 * Login user
 * POST /api/v1/auth/login
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

    const { accessToken, refreshToken, refreshMaxAgeMs, user } = await authService.login(
      email,
      password
    );

    setRefreshTokenCookie(res, refreshToken, refreshMaxAgeMs);

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
 * POST /api/v1/auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    const { accessToken, refreshToken: rotatedRefreshToken, refreshMaxAgeMs } =
      await authService.refresh(refreshToken);

    setRefreshTokenCookie(res, rotatedRefreshToken, refreshMaxAgeMs);

    res.json({
      success: true,
      accessToken,
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    next(error);
  }
}

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
async function logout(req, res, next) {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    await authService.logout(refreshToken, req.user?.id);
    clearRefreshTokenCookie(res);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user
 * GET /api/v1/auth/me
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

module.exports = {
  login,
  refresh,
  logout,
  getMe,
};

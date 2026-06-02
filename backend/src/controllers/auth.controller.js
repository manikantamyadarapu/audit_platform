const authService = require('../services/auth.service');

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Login
    const { token, user } = await authService.login(email, password);

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

module.exports = {
  login,
  getMe,
};

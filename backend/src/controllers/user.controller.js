const userService = require('../services/user.service');

/**
 * Create user
 * POST /api/users
 */
async function createUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required',
      });
    }

    // Validate role
    const validRoles = ['ADMIN', 'AUDITOR', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be ADMIN, AUDITOR, or VIEWER',
      });
    }

    const user = await userService.createUser({ name, email, password, role });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all users
 * GET /api/users
 */
async function getAllUsers(req, res, next) {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const result = await userService.getAllUsers({
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get user by ID
 * GET /api/users/:id
 */
async function getUserById(req, res, next) {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(parseInt(id, 10));

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user
 * PUT /api/users/:id
 */
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, role } = req.body;

    // Validate role if provided
    if (role) {
      const validRoles = ['ADMIN', 'AUDITOR', 'VIEWER'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Must be ADMIN, AUDITOR, or VIEWER',
        });
      }
    }

    const user = await userService.updateUser(parseInt(id, 10), { name, role });

    res.json({
      success: true,
      message: 'User updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change user password
 * PUT /api/users/:id/password
 */
async function changePassword(req, res, next) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    await userService.changePassword(parseInt(id, 10), newPassword);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete user
 * DELETE /api/users/:id
 */
async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    await userService.deleteUser(parseInt(id, 10));

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  changePassword,
  deleteUser,
};

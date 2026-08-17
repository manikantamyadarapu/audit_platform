const userRepository = require('../repositories/user.repository');
const { hashPassword } = require('../utils/password.util');

/**
 * Create new user
 * @param {Object} userData
 * @returns {Promise<Object>}
 * @throws {Error} If email already exists or role invalid
 */
async function createUser(userData) {
  // Check if email already exists
  const emailExists = await userRepository.emailExists(userData.email);
  if (emailExists) {
    const error = new Error('Email already exists');
    error.statusCode = 409;
    throw error;
  }

  // Validate role
  const validRoles = ['ADMIN', 'AUDITOR', 'VIEWER'];
  if (!validRoles.includes(userData.role)) {
    const error = new Error('Invalid role');
    error.statusCode = 400;
    throw error;
  }

  // Hash password
  const passwordHash = await hashPassword(userData.password);

  // Create user with role enum
  const user = await userRepository.create({
    name: userData.name,
    email: userData.email,
    passwordHash,
    role: userData.role,
    isActive: true,
  });

  return user;
}

/**
 * Get all users with pagination and search
 * @param {Object} options
 * @returns {Promise<{users: Array, pagination: Object}>}
 */
async function getAllUsers(options) {
  const { users, total } = await userRepository.findAll(options);

  const { page = 1, limit = 10 } = options;
  const totalPages = Math.ceil(total / limit);

  return {
    users,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages,
    },
  };
}

/**
 * Get user by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 * @throws {Error} If user not found
 */
async function getUserById(id) {
  const user = await userRepository.findById(id);

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Remove sensitive data
  const { passwordHash, ...userWithoutSensitive } = user;

  return userWithoutSensitive;
}

/**
 * Update user
 * @param {number} id
 * @param {Object} updateData
 * @returns {Promise<Object>}
 * @throws {Error} If user not found or email exists
 */
async function updateUser(id, updateData) {
  // Check if user exists
  const existingUser = await userRepository.findById(id);
  if (!existingUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Check email uniqueness if email is being updated
  if (updateData.email && updateData.email !== existingUser.email) {
    const emailExists = await userRepository.emailExists(updateData.email, id);
    if (emailExists) {
      const error = new Error('Email already exists');
      error.statusCode = 409;
      throw error;
    }
  }

  // Validate role if being updated
  const dataToUpdate = { ...updateData };
  if (updateData.role) {
    const validRoles = ['ADMIN', 'AUDITOR', 'VIEWER'];
    if (!validRoles.includes(updateData.role)) {
      const error = new Error('Invalid role');
      error.statusCode = 400;
      throw error;
    }
  }

  // Hash password if provided
  if (updateData.password) {
    dataToUpdate.passwordHash = await hashPassword(updateData.password);
    delete dataToUpdate.password;
  }

  const user = await userRepository.update(id, dataToUpdate);
  return user;
}

/**
 * Change user password
 * @param {number} id
 * @param {string} newPassword
 * @returns {Promise<Object>}
 * @throws {Error} If user not found
 */
async function changePassword(id, newPassword) {
  // Check if user exists
  const existingUser = await userRepository.findById(id);
  if (!existingUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  const user = await userRepository.updatePassword(id, passwordHash);
  return user;
}

/**
 * Delete user (soft delete)
 * @param {number} id
 * @returns {Promise<Object>}
 * @throws {Error} If user not found
 */
async function deleteUser(id) {
  // Check if user exists
  const existingUser = await userRepository.findById(id);
  if (!existingUser) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  const user = await userRepository.softDelete(id);
  return user;
}

module.exports = {
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  changePassword,
  deleteUser,
};

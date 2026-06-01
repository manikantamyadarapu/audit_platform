const userRepository = require('../repositories/user.repository');
const { generateToken } = require('../utils/jwt.util');
const { comparePassword } = require('../utils/password.util');

/**
 * Login user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{token: string, user: Object}>}
 * @throws {Error} If credentials are invalid
 */
async function login(email, password) {
  // Find user by email
  const user = await userRepository.findActiveByEmail(email);

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Compare password
  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Get role name from role relation
  const roleName = user.role?.roleName || 'VIEWER';

  // Generate JWT token
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: roleName,
  });

  // Return user without passwordHash and transform role
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
 * Get current user by ID
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) return null;

  // Transform role
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
};

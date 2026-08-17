const prisma = require('../lib/prisma');

/**
 * Find user by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  return prisma.user.findUnique({
    where: { id, isActive: true },
  });
}

/**
 * Find user by email (including password for auth)
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findByEmail(email) {
  return prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Find user by email with active status
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
async function findActiveByEmail(email) {
  return prisma.user.findFirst({
    where: { email, isActive: true },
  });
}

/**
 * Create new user
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function create(data) {
  const user = await prisma.user.create({
    data,
  });
  return user;
}

/**
 * Get all users with pagination and search
 * @param {Object} options
 * @param {string} options.search - Search term
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @returns {Promise<{users: Array, total: number}>}
 */
async function findAll({ search = '', page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;

  const where = {
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total };
}

/**
 * Update user
 * @param {number} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function update(id, data) {
  const user = await prisma.user.update({
    where: { id },
    data,
  });
  return user;
}

/**
 * Update user password
 * @param {number} id
 * @param {string} passwordHash
 * @returns {Promise<Object>}
 */
async function updatePassword(id, passwordHash) {
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
  return user;
}

/**
 * Soft delete user (set isActive to false)
 * @param {number} id
 * @returns {Promise<Object>}
 */
async function softDelete(id) {
  const user = await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
  return user;
}

/**
 * Check if email exists
 * @param {string} email
 * @param {number} excludeId - Optional user ID to exclude
 * @returns {Promise<boolean>}
 */
async function emailExists(email, excludeId = null) {
  const where = { email };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  const count = await prisma.user.count({ where });
  return count > 0;
}

module.exports = {
  findById,
  findByEmail,
  findActiveByEmail,
  create,
  findAll,
  update,
  updatePassword,
  softDelete,
  emailExists,
};

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Find user by ID
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  return prisma.user.findUnique({
    where: { id, isActive: true },
    include: {
      role: {
        select: {
          roleName: true,
        },
      },
    },
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
    include: {
      role: {
        select: {
          id: true,
          roleName: true,
        },
      },
    },
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
    include: {
      role: {
        select: {
          id: true,
          roleName: true,
        },
      },
    },
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
    include: {
      role: {
        select: {
          roleName: true,
        },
      },
    },
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
      include: {
        role: {
          select: {
            roleName: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Transform users to include role as string
  const transformedUsers = users.map(user => ({
    ...user,
    role: user.role?.roleName || null,
  }));

  return { users: transformedUsers, total };
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
    include: {
      role: {
        select: {
          roleName: true,
        },
      },
    },
  });
  return {
    ...user,
    role: user.role?.roleName || null,
  };
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
    include: {
      role: {
        select: {
          roleName: true,
        },
      },
    },
  });
  return {
    ...user,
    role: user.role?.roleName || null,
  };
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
    include: {
      role: {
        select: {
          roleName: true,
        },
      },
    },
  });
  return {
    ...user,
    role: user.role?.roleName || null,
  };
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

/**
 * Get role by name
 * @param {string} roleName
 * @returns {Promise<Object|null>}
 */
async function getRoleByName(roleName) {
  return prisma.role.findUnique({
    where: { roleName },
  });
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
  getRoleByName,
};

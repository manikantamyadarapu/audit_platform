const prisma = require('../lib/prisma');
const { HELD_FINANCIALS_TTL_DAYS } = require('../config');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeExpiresAt(fromDate = new Date()) {
  return new Date(fromDate.getTime() + HELD_FINANCIALS_TTL_DAYS * MS_PER_DAY);
}

/**
 * @param {number} userId
 * @param {string} branch
 * @returns {Promise<object[]>}
 */
async function listActiveByUserBranch(userId, branch) {
  const now = new Date();
  return prisma.heldFinancialFile.findMany({
    where: {
      userId,
      branch,
      expiresAt: { gt: now },
    },
    orderBy: { slotKey: 'asc' },
  });
}

/**
 * @param {number} userId
 * @param {string} branch
 * @returns {Promise<object[]>}
 */
async function listAllByUserBranch(userId, branch) {
  return prisma.heldFinancialFile.findMany({
    where: { userId, branch },
  });
}

/**
 * @param {object} row
 * @returns {Promise<object>}
 */
async function upsertSlot(row) {
  const {
    userId,
    branch,
    slotKey,
    uploadSessionId,
    originalName,
    storagePath,
    sizeBytes,
    contentType,
    expiresAt,
  } = row;

  return prisma.heldFinancialFile.upsert({
    where: {
      userId_branch_slotKey: { userId, branch, slotKey },
    },
    create: {
      userId,
      branch,
      slotKey,
      uploadSessionId,
      originalName,
      storagePath,
      sizeBytes,
      contentType,
      expiresAt,
    },
    update: {
      uploadSessionId,
      originalName,
      storagePath,
      sizeBytes,
      contentType,
      expiresAt,
    },
  });
}

/**
 * @param {number} userId
 * @param {string} branch
 * @returns {Promise<{ count: number }>}
 */
async function deleteByUserBranch(userId, branch) {
  return prisma.heldFinancialFile.deleteMany({
    where: { userId, branch },
  });
}

/**
 * @returns {Promise<object[]>}
 */
async function listExpired(now = new Date()) {
  return prisma.heldFinancialFile.findMany({
    where: { expiresAt: { lte: now } },
  });
}

/**
 * @param {number[]} ids
 * @returns {Promise<{ count: number }>}
 */
async function deleteByIds(ids) {
  if (!ids.length) return { count: 0 };
  return prisma.heldFinancialFile.deleteMany({
    where: { id: { in: ids } },
  });
}

module.exports = {
  computeExpiresAt,
  listActiveByUserBranch,
  listAllByUserBranch,
  upsertSlot,
  deleteByUserBranch,
  listExpired,
  deleteByIds,
};

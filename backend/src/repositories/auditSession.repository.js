const prisma = require('../lib/prisma');

const RETENTION_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeExpiresAt(fromDate = new Date()) {
  return new Date(fromDate.getTime() + RETENTION_DAYS * MS_PER_DAY);
}

/**
 * @param {string} auditCode
 * @returns {Promise<{ id: number, auditCode: string } | null>}
 */
async function findAuditTypeByCode(auditCode) {
  return prisma.auditType.findUnique({
    where: { auditCode },
    select: { id: true, auditCode: true },
  });
}

/**
 * @param {number} auditTypeId
 * @returns {Promise<{ id: number, auditCode: string } | null>}
 */
async function findAuditTypeById(auditTypeId) {
  return prisma.auditType.findUnique({
    where: { id: auditTypeId },
    select: { id: true, auditCode: true },
  });
}

/**
 * @param {number} userId
 * @param {string} sessionKey
 * @returns {Promise<object | null>}
 */
async function findActiveSession(userId, sessionKey) {
  const now = new Date();
  return prisma.auditSession.findFirst({
    where: {
      userId,
      sessionKey,
      isActive: true,
      expiresAt: { gt: now },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * @param {number} userId
 * @param {number} auditTypeId
 * @returns {Promise<object | null>}
 */
async function findActiveSessionByAuditType(userId, auditTypeId) {
  const now = new Date();
  return prisma.auditSession.findFirst({
    where: {
      userId,
      auditTypeId,
      isActive: true,
      expiresAt: { gt: now },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Upsert session — one active session per user + audit type (via sessionKey).
 * @param {object} params
 * @returns {Promise<object>}
 */
async function upsertSession(params) {
  const {
    userId,
    auditTypeId,
    sessionKey,
    pageRoute,
    auditRunId = null,
    fileName = null,
    status = 'COMPLETED',
    sessionData = null,
  } = params;

  const now = new Date();
  const expiresAt = computeExpiresAt(now);

  return prisma.auditSession.upsert({
    where: { sessionKey },
    create: {
      userId,
      auditTypeId,
      sessionKey,
      pageRoute,
      auditRunId,
      fileName,
      status,
      sessionData,
      isActive: true,
      expiresAt,
      lastAccessedAt: now,
    },
    update: {
      pageRoute,
      auditRunId,
      fileName,
      status,
      sessionData,
      isActive: true,
      expiresAt,
      lastAccessedAt: now,
    },
  });
}

/**
 * @param {number} sessionId
 * @returns {Promise<object>}
 */
async function touchSession(sessionId) {
  return prisma.auditSession.update({
    where: { id: sessionId },
    data: { lastAccessedAt: new Date() },
  });
}

/**
 * @param {number} userId
 * @param {string} sessionKey
 * @returns {Promise<object>}
 */
async function deactivateSession(userId, sessionKey) {
  return prisma.auditSession.updateMany({
    where: { userId, sessionKey, isActive: true },
    data: { isActive: false },
  });
}

/**
 * @param {number} userId
 * @param {number} auditTypeId
 * @returns {Promise<object>}
 */
async function deactivateSessionsByAuditType(userId, auditTypeId) {
  return prisma.auditSession.updateMany({
    where: { userId, auditTypeId, isActive: true },
    data: { isActive: false },
  });
}

/**
 * Delete expired or inactive sessions past retention.
 * @returns {Promise<number>}
 */
async function deleteExpiredSessions() {
  const now = new Date();
  const result = await prisma.auditSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lte: now } },
        { isActive: false, updatedAt: { lte: new Date(now.getTime() - MS_PER_DAY) } },
      ],
    },
  });
  return result.count;
}

/**
 * Active sessions for a user that expire before the given time (still in the future).
 * @param {number} userId
 * @param {Date} before
 */
async function findActiveSessionsExpiringBefore(userId, before) {
  const now = new Date();
  return prisma.auditSession.findMany({
    where: {
      userId,
      isActive: true,
      expiresAt: { gt: now, lte: before },
    },
    include: {
      auditType: {
        select: { id: true, auditCode: true, auditName: true },
      },
    },
    orderBy: { expiresAt: 'asc' },
  });
}

module.exports = {
  RETENTION_DAYS,
  computeExpiresAt,
  findAuditTypeByCode,
  findAuditTypeById,
  findActiveSession,
  findActiveSessionByAuditType,
  upsertSession,
  touchSession,
  deactivateSession,
  deactivateSessionsByAuditType,
  deleteExpiredSessions,
  findActiveSessionsExpiringBefore,
};

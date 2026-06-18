const auditSessionRepository = require('../repositories/auditSession.repository');
const auditRunRepository = require('../repositories/auditRun.repository');

/**
 * Build unique session key: USER_{userId}_{auditCode}
 * @param {number} userId
 * @param {string} auditCode
 */
function buildSessionKey(userId, auditCode) {
  return `USER_${userId}_${auditCode}`;
}

/**
 * Resolve audit type from id or code.
 * @param {{ auditTypeId?: number, auditCode?: string }}
 */
async function resolveAuditType({ auditTypeId, auditCode }) {
  if (auditTypeId) {
    const auditType = await auditSessionRepository.findAuditTypeById(Number(auditTypeId));
    if (!auditType) {
      const err = new Error('Invalid audit type');
      err.statusCode = 400;
      throw err;
    }
    return auditType;
  }

  if (auditCode) {
    const normalized = String(auditCode).toUpperCase();
    const existing = await auditSessionRepository.findAuditTypeByCode(normalized);
    if (existing) return existing;

    const auditTypeId = await auditRunRepository.resolveAuditTypeId(normalized);
    if (!auditTypeId) {
      const err = new Error('Invalid audit type code');
      err.statusCode = 400;
      throw err;
    }

    const created = await auditSessionRepository.findAuditTypeById(auditTypeId);
    if (!created) {
      const err = new Error('Invalid audit type code');
      err.statusCode = 400;
      throw err;
    }
    return created;
  }

  const err = new Error('auditTypeId or auditCode is required');
  err.statusCode = 400;
  throw err;
}

/**
 * @param {number} userId
 * @param {{ auditTypeId?: number, auditCode?: string }} query
 */
async function restoreSession(userId, query) {
  const auditType = await resolveAuditType(query);

  // One active session per user per audit type — never cross-audit
  const session = await auditSessionRepository.findActiveSessionByAuditType(
    userId,
    auditType.id
  );
  if (!session) {
    return null;
  }

  // Extra guard: session must belong to this audit type
  if (session.auditTypeId !== auditType.id) {
    return null;
  }

  await auditSessionRepository.touchSession(session.id);

  const sessionPayload = session.sessionData && typeof session.sessionData === 'object'
    ? session.sessionData
    : {};

  return {
    auditRunId: session.auditRunId,
    auditTypeId: session.auditTypeId,
    fileName: session.fileName,
    status: session.status,
    pageRoute: session.pageRoute,
    savedAt: session.updatedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    results: sessionPayload,
  };
}

/**
 * @param {number} userId
 * @param {object} body
 */
async function saveSession(userId, body) {
  const auditType = await resolveAuditType(body);
  const sessionKey = buildSessionKey(userId, auditType.auditCode);

  const sessionData = body.sessionData ?? body.results ?? null;
  const fileName =
    body.fileName ??
    sessionData?.fileName ??
    sessionData?.result?.fileName ??
    null;

  const status = body.status ?? inferStatus(sessionData);

  const session = await auditSessionRepository.upsertSession({
    userId,
    auditTypeId: auditType.id,
    sessionKey,
    pageRoute: body.pageRoute || '',
    auditRunId: body.auditRunId ? Number(body.auditRunId) : null,
    fileName,
    status,
    sessionData,
  });

  return {
    id: session.id,
    sessionKey: session.sessionKey,
    auditRunId: session.auditRunId,
    auditTypeId: session.auditTypeId,
    fileName: session.fileName,
    status: session.status,
    savedAt: session.updatedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

/**
 * @param {number} userId
 * @param {{ auditTypeId?: number, auditCode?: string }} query
 */
async function clearSession(userId, query) {
  const auditType = await resolveAuditType(query);
  await auditSessionRepository.deactivateSessionsByAuditType(userId, auditType.id);
  return { cleared: true, auditTypeId: auditType.id };
}

function inferStatus(sessionData) {
  if (!sessionData) return 'PENDING';
  if (sessionData.sheetError) return 'FAILED';
  if (sessionData.result) return 'COMPLETED';
  return 'PROCESSING';
}

async function cleanupExpiredSessions() {
  return auditSessionRepository.deleteExpiredSessions();
}

module.exports = {
  buildSessionKey,
  restoreSession,
  saveSession,
  clearSession,
  cleanupExpiredSessions,
  RETENTION_DAYS: auditSessionRepository.RETENTION_DAYS,
};

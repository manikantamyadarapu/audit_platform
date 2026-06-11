const notificationRepository = require('../repositories/notification.repository');
const auditSessionRepository = require('../repositories/auditSession.repository');
const {
  NOTIFICATION_TYPES,
  AUDIT_LABELS,
  AUDIT_ROUTES,
  HIGH_EXCEPTION_MIN_ROWS,
  HIGH_EXCEPTION_MIN_TOTAL,
  HIGH_EXCEPTION_PERCENT,
  SESSION_EXPIRING_HOURS,
} = require('../constants/notifications');
const logger = require('../utils/logger');

function isHighExceptionCount(exceptionRows, totalRows) {
  const exceptions = Number(exceptionRows) || 0;
  const total = Number(totalRows) || 0;
  if (exceptions <= 0) return false;
  if (exceptions >= HIGH_EXCEPTION_MIN_ROWS) return true;
  if (total >= HIGH_EXCEPTION_MIN_TOTAL && exceptions / total >= HIGH_EXCEPTION_PERCENT) {
    return true;
  }
  return false;
}

function extractAuditMetrics(data) {
  const summary = data?.summary ?? {};
  const totalRows = Number(data?.totalRows ?? summary.totalRows ?? 0) || 0;
  const exceptionRows =
    Number(
      data?.errorRows ??
        summary.exceptionRowCount ??
        summary.errorRowsCount ??
        summary.distinctInvalidRows ??
        summary.returnValidationErrorRows ??
        (Array.isArray(data?.exceptionRecords) ? data.exceptionRecords.length : NaN) ??
        (Array.isArray(data?.records) ? data.records.length : NaN) ??
        0
    ) || 0;

  return { totalRows, exceptionRows };
}

async function safeCreate(payload) {
  try {
    return await notificationRepository.create(payload);
  } catch (error) {
    logger.error('Failed to create notification', {
      type: payload.type,
      userId: payload.userId,
      message: error.message,
    });
    return null;
  }
}

/**
 * @param {number} userId
 * @param {string} auditKey
 * @param {string} fileName
 * @param {object} data - Python audit response
 */
async function notifyAuditCompleted(userId, auditKey, fileName, data) {
  if (!userId) return;

  const label = AUDIT_LABELS[auditKey] || 'Audit';
  const route = AUDIT_ROUTES[auditKey] || null;
  const { totalRows, exceptionRows } = extractAuditMetrics(data);
  const safeName = fileName || 'Uploaded file';

  await safeCreate({
    userId,
    type: NOTIFICATION_TYPES.AUDIT_COMPLETED,
    title: `${label} audit completed`,
    message: `${safeName}: ${totalRows} rows processed${
      exceptionRows > 0 ? `, ${exceptionRows} exception row(s)` : ', no exceptions'
    }.`,
    actionUrl: route,
    metadata: { auditKey, fileName: safeName, totalRows, exceptionRows },
  });

  if (isHighExceptionCount(exceptionRows, totalRows)) {
    await safeCreate({
      userId,
      type: NOTIFICATION_TYPES.HIGH_EXCEPTION_COUNT,
      title: `High exception count — ${label}`,
      message: `${safeName}: ${exceptionRows} exception row(s) found (${totalRows} total rows). Review the report.`,
      actionUrl: route,
      metadata: { auditKey, fileName: safeName, totalRows, exceptionRows },
    });
  }
}

/**
 * @param {number} userId
 * @param {string} auditKey
 * @param {string} fileName
 * @param {string} reason
 */
async function notifyAuditFailed(userId, auditKey, fileName, reason) {
  if (!userId) return;

  const label = AUDIT_LABELS[auditKey] || 'Audit';
  const route = AUDIT_ROUTES[auditKey] || null;
  const safeName = fileName || 'Uploaded file';

  await safeCreate({
    userId,
    type: NOTIFICATION_TYPES.AUDIT_FAILED,
    title: `${label} audit failed`,
    message: `${safeName}: ${reason || 'The audit could not be completed.'}`,
    actionUrl: route,
    metadata: { auditKey, fileName: safeName, reason },
  });
}

/**
 * @param {number} userId
 * @param {string} auditKey
 * @param {string} reason
 */
async function notifyMissingPrerequisite(userId, auditKey, reason) {
  if (!userId) return;

  const label = AUDIT_LABELS[auditKey] || 'Audit';
  const route = AUDIT_ROUTES[auditKey] || null;

  await safeCreate({
    userId,
    type: NOTIFICATION_TYPES.MISSING_PREREQUISITE,
    title: `Prerequisite missing — ${label}`,
    message: reason || 'A required step must be completed before this audit can run.',
    actionUrl: route,
    metadata: { auditKey, reason },
  });
}

/**
 * Create SESSION_EXPIRING_SOON for active sessions expiring within 24h (deduped per session).
 * @param {number} userId
 */
async function syncSessionExpiringNotifications(userId) {
  if (!userId) return;

  const now = new Date();
  const threshold = new Date(now.getTime() + SESSION_EXPIRING_HOURS * 60 * 60 * 1000);
  const dedupeSince = new Date(now.getTime() - SESSION_EXPIRING_HOURS * 60 * 60 * 1000);

  const sessions = await auditSessionRepository.findActiveSessionsExpiringBefore(userId, threshold);
  if (!sessions.length) return;

  for (const session of sessions) {
    const existing = await notificationRepository.findRecentByTypeAndMetadata(
      userId,
      NOTIFICATION_TYPES.SESSION_EXPIRING_SOON,
      'sessionId',
      session.id,
      dedupeSince
    );
    if (existing.length > 0) continue;

    const hoursLeft = Math.max(
      1,
      Math.ceil((session.expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000))
    );
    const auditLabel = session.auditType?.auditName || session.auditType?.auditCode || 'Audit';

    await safeCreate({
      userId,
      type: NOTIFICATION_TYPES.SESSION_EXPIRING_SOON,
      title: 'Saved audit results expiring soon',
      message: `${auditLabel}${session.fileName ? ` (${session.fileName})` : ''} expires in about ${hoursLeft} hour(s). Export your report if you need to keep it.`,
      actionUrl: session.pageRoute || null,
      metadata: {
        sessionId: session.id,
        auditTypeId: session.auditTypeId,
        fileName: session.fileName,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  }
}

module.exports = {
  isHighExceptionCount,
  extractAuditMetrics,
  notifyAuditCompleted,
  notifyAuditFailed,
  notifyMissingPrerequisite,
  syncSessionExpiringNotifications,
};

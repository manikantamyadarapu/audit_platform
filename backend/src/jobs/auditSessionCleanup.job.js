const auditSessionService = require('../services/auditSession.service');
const logger = require('../utils/logger');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Run daily cleanup of expired audit sessions.
 * @returns {() => void} stop function
 */
function startAuditSessionCleanupJob() {
  let running = false;

  async function runCleanup() {
    if (running) return;
    running = true;
    try {
      const deleted = await auditSessionService.cleanupExpiredSessions();
      if (deleted > 0) {
        logger.info('Audit session cleanup completed', { deleted });
      }
    } catch (error) {
      logger.error('Audit session cleanup failed', { message: error.message });
    } finally {
      running = false;
    }
  }

  // Run once on startup, then daily
  runCleanup();
  const timer = setInterval(runCleanup, MS_PER_DAY);
  timer.unref();

  return () => clearInterval(timer);
}

module.exports = {
  startAuditSessionCleanupJob,
};

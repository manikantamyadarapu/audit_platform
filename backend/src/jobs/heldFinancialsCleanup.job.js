const heldFinancialsService = require('../services/heldFinancials.service');
const logger = require('../utils/logger');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Daily cleanup of expired held Financials workbooks.
 * @returns {() => void}
 */
function startHeldFinancialsCleanupJob() {
  let running = false;

  async function runCleanup() {
    if (running) return;
    running = true;
    try {
      const deleted = await heldFinancialsService.cleanupExpiredHeldFiles();
      if (deleted > 0) {
        logger.info('Held Financials cleanup completed', { deleted });
      }
    } catch (error) {
      logger.error('Held Financials cleanup failed', { message: error.message });
    } finally {
      running = false;
    }
  }

  runCleanup();
  const timer = setInterval(runCleanup, MS_PER_DAY);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = {
  startHeldFinancialsCleanupJob,
};

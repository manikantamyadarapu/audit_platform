const section44abService = require('../services/section44ab.service');
const logger = require('../utils/logger');

async function validateSection44AB(req, res, next) {
  try {
    if (!req.files || (!req.files.cashFiles && !req.files.bankFiles)) {
      return res.status(400).json({
        success: false,
        detail: 'Missing cashFiles or bankFiles fields',
        requestId: req.requestId,
      });
    }

    const cashFiles = req.files.cashFiles || [];
    const bankFiles = req.files.bankFiles || [];

    if (cashFiles.length === 0 && bankFiles.length === 0) {
      return res.status(400).json({
        success: false,
        detail: 'At least one Cash or Bank file must be provided',
        requestId: req.requestId,
      });
    }

    logger.info('Section 44AB: forwarding to Python', {
      requestId: req.requestId,
      cashFileCount: cashFiles.length,
      bankFileCount: bankFiles.length,
    });

    const { data, auditRunId } = await section44abService.validateSection44AB(req, cashFiles, bankFiles);
    return res.json({ ...data, auditRunId });
  } catch (err) {
    section44abService.notifySection44ABFailure(req, err);
    return next(err);
  }
}

module.exports = {
  validateSection44AB,
};

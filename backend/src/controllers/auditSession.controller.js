const auditSessionService = require('../services/auditSession.service');
const SuccessResponse = require('../utils/successResponse');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * GET /api/audit-sessions/restore
 * GET /api/v1/audit-sessions/restore
 */
async function restore(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const { auditTypeId, auditCode } = req.query;
    if (!auditTypeId && !auditCode) {
      return ErrorResponse(res, 400, 'auditTypeId or auditCode is required');
    }

    const data = await auditSessionService.restoreSession(userId, { auditTypeId, auditCode });

    return SuccessResponse(res, data ? 'Audit session restored' : 'No active audit session found', data);
  } catch (error) {
    if (error.statusCode === 400) {
      return ErrorResponse(res, 400, error.message);
    }

    logger.error('Audit session restore failed', {
      userId: req.user?.id,
      message: error.message,
    });

    return next(error);
  }
}

/**
 * POST /api/audit-sessions/save
 * POST /api/v1/audit-sessions/save
 */
async function save(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const { auditTypeId, auditCode, pageRoute } = req.body || {};
    if (!auditTypeId && !auditCode) {
      return ErrorResponse(res, 400, 'auditTypeId or auditCode is required');
    }
    if (!pageRoute) {
      return ErrorResponse(res, 400, 'pageRoute is required');
    }

    const data = await auditSessionService.saveSession(userId, req.body);

    return SuccessResponse(res, 'Audit session saved', data);
  } catch (error) {
    if (error.statusCode === 400) {
      return ErrorResponse(res, 400, error.message);
    }

    logger.error('Audit session save failed', {
      userId: req.user?.id,
      message: error.message,
    });

    return next(error);
  }
}

/**
 * DELETE /api/audit-sessions/clear
 * DELETE /api/v1/audit-sessions/clear
 */
async function clear(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const { auditTypeId, auditCode } = req.query;
    if (!auditTypeId && !auditCode) {
      return ErrorResponse(res, 400, 'auditTypeId or auditCode is required');
    }

    const data = await auditSessionService.clearSession(userId, { auditTypeId, auditCode });

    return SuccessResponse(res, 'Audit session cleared', data);
  } catch (error) {
    if (error.statusCode === 400) {
      return ErrorResponse(res, 400, error.message);
    }

    logger.error('Audit session clear failed', {
      userId: req.user?.id,
      message: error.message,
    });

    return next(error);
  }
}

module.exports = {
  restore,
  save,
  clear,
};

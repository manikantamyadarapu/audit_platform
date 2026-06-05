const dashboardService = require('../services/dashboard.service');
const SuccessResponse = require('../utils/successResponse');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard/widgets
 * GET /api/v1/dashboard/widgets
 */
async function getDashboardWidgets(req, res, next) {
  try {
    const user = req.user;

    if (!user?.id) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const data = await dashboardService.getDashboardWidgets(req.query, user);

    if (!data) {
      return ErrorResponse(res, 404, 'Dashboard data not found');
    }

    return SuccessResponse(res, 'Dashboard widgets fetched successfully', data);
  } catch (error) {
    if (error.statusCode === 400) {
      return ErrorResponse(res, 400, error.message);
    }

    logger.error('Dashboard widgets fetch failed', {
      userId: req.user?.id,
      message: error.message,
    });

    return next(error);
  }
}

/**
 * GET /api/dashboard/audit-trend
 * GET /api/v1/dashboard/audit-trend
 */
async function getAuditTrend(req, res, next) {
  try {
    const user = req.user;

    if (!user?.id) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const data = await dashboardService.getAuditTrend(req.query, user);
    const message = data.isEmpty
      ? 'No audit trend data available'
      : 'Audit trend fetched successfully';

    const { isEmpty, ...payload } = data;

    return SuccessResponse(res, message, payload);
  } catch (error) {
    if (error.statusCode === 400) {
      return ErrorResponse(res, 400, error.message);
    }

    logger.error('Audit trend fetch failed', {
      userId: req.user?.id,
      message: error.message,
    });

    return next(error);
  }
}

/**
 * GET /api/dashboard/issues-category
 * GET /api/v1/dashboard/issues-category
 */
async function getIssuesByCategory(req, res, next) {
  try {
    const user = req.user;

    if (!user?.id) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const data = await dashboardService.getIssuesByCategory(req.query, user);
    const message = data.isEmpty
      ? 'No issue data found'
      : 'Issues by category fetched successfully';

    const { isEmpty, ...payload } = data;

    return SuccessResponse(res, message, payload);
  } catch (error) {
    if (error.statusCode === 400) {
      return ErrorResponse(res, 400, error.message);
    }

    logger.error('Issues by category fetch failed', {
      userId: req.user?.id,
      message: error.message,
    });

    return next(error);
  }
}

module.exports = {
  getDashboardWidgets,
  getAuditTrend,
  getIssuesByCategory,
};

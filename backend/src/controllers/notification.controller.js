const notificationService = require('../services/notification.service');
const SuccessResponse = require('../utils/successResponse');
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * GET /api/notifications
 */
async function list(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const unreadOnly = req.query.unreadOnly === 'true';

    const data = await notificationService.listForUser(userId, { limit, unreadOnly });

    return SuccessResponse(res, 'Notifications fetched', data);
  } catch (error) {
    logger.error('Notification list failed', {
      userId: req.user?.id,
      message: error.message,
    });
    return next(error);
  }
}

/**
 * PATCH /api/notifications/:id/read
 */
async function markRead(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const notificationId = Number(req.params.id);
    if (!Number.isFinite(notificationId)) {
      return ErrorResponse(res, 400, 'Invalid notification id');
    }

    const unreadCount = await notificationService.markRead(userId, notificationId);

    return SuccessResponse(res, 'Notification marked as read', { unreadCount });
  } catch (error) {
    if (error.statusCode === 404) {
      return ErrorResponse(res, 404, error.message);
    }

    logger.error('Notification mark read failed', {
      userId: req.user?.id,
      message: error.message,
    });
    return next(error);
  }
}

/**
 * POST /api/notifications/read-all
 */
async function markAllRead(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const unreadCount = await notificationService.markAllRead(userId);

    return SuccessResponse(res, 'All notifications marked as read', { unreadCount });
  } catch (error) {
    logger.error('Notification mark all read failed', {
      userId: req.user?.id,
      message: error.message,
    });
    return next(error);
  }
}

module.exports = {
  list,
  markRead,
  markAllRead,
};

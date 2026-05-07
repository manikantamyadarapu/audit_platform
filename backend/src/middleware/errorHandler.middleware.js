const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const requestId = req.requestId || undefined;

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      detail: 'File too large',
      requestId,
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      detail: 'Unexpected file field (use field name "file")',
      requestId,
    });
  }

  const status =
    err.status && Number.isInteger(err.status) ? err.status : err.statusCode && Number.isInteger(err.statusCode)
      ? err.statusCode
      : 500;
  const detail = status === 500 ? 'Internal server error' : err.message || 'Request failed';

  if (status >= 500) {
    logger.error(err.message || 'Unhandled error', { requestId, stack: err.stack });
  }

  if (err.apiBody && typeof err.apiBody === 'object') {
    return res.status(status).json({
      ...err.apiBody,
      requestId: err.apiBody.requestId || requestId,
    });
  }

  return res.status(status).json({
    success: false,
    detail,
    requestId,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    detail: `Not found: ${req.method} ${req.path}`,
    requestId: req.requestId,
  });
}

module.exports = { errorHandler, notFoundHandler };

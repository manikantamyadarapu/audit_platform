/**
 * Standard error JSON response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 */
function ErrorResponse(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

module.exports = ErrorResponse;

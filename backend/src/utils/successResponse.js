/**
 * Standard success JSON response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {*} data
 * @param {number} [statusCode=200]
 */
function SuccessResponse(res, message, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

module.exports = SuccessResponse;

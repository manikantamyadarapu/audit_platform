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

/**
 * Standard paginated success JSON response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {Array|*} data
 * @param {{ page: number, limit: number, total: number, totalPages: number }} pagination
 * @param {number} [statusCode=200]
 */
function PaginatedSuccessResponse(res, message, data, pagination, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
  });
}

module.exports = SuccessResponse;
module.exports.PaginatedSuccessResponse = PaginatedSuccessResponse;

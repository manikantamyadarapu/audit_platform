const salesAuditService = require('../services/salesAudit.service');
const SuccessResponse = require('../utils/successResponse');
const PaginatedSuccessResponse = SuccessResponse.PaginatedSuccessResponse;
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

/**
 * GET /api/v1/sales-audit/product-average-rates
 */
async function getProductAverageRates(req, res, next) {
  try {
    if (!req.user?.id) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const { rows, pagination, meta } = await salesAuditService.getProductAverageRates(req.query);
    return PaginatedSuccessResponse(
      res,
      'Product average rates fetched successfully',
      rows,
      pagination,
      200,
      meta
    );
  } catch (error) {
    logger.error('Product average rates fetch failed', {
      userId: req.user?.id,
      message: error.message,
    });
    return next(error);
  }
}

/**
 * GET /api/v1/sales-audit/product-average-rates/export
 */
async function exportProductAverageRates(req, res, next) {
  try {
    if (!req.user?.id) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const rows = await salesAuditService.getProductAverageRatesForExport(req.query);
    const header = [
      'Product',
      'Sales Account',
      'Total Quantity',
      'Total Gross Amount',
      'Average Unit Rate',
      'Transaction Count',
      'Created Date',
      'Source File',
    ];
    const csvLines = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.product,
          row.salesAccount,
          row.totalQuantity,
          row.totalGrossAmount,
          row.averageRate,
          row.transactionCount,
          row.createdAt ? new Date(row.createdAt).toISOString() : '',
          row.fileName || '',
        ]
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];

    const buffer = Buffer.from(csvLines.join('\n'), 'utf8');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="product-average-rates-${Date.now()}.csv"`
    );
    return res.send(buffer);
  } catch (error) {
    logger.error('Product average rates export failed', {
      userId: req.user?.id,
      message: error.message,
    });
    return next(error);
  }
}

module.exports = {
  getProductAverageRates,
  exportProductAverageRates,
};

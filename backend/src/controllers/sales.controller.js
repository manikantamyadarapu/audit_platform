const salesService = require('../services/sales.service');
const { validateSalesExportInvalidBody } = require('../validators/sales.validator');
const SuccessResponse = require('../utils/successResponse');
const PaginatedSuccessResponse = SuccessResponse.PaginatedSuccessResponse;
const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');

async function validate(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        detail: 'Missing file field "file"',
        requestId: req.requestId,
      });
    }

    logger.info('Sales audit: forwarding to Python', {
      requestId: req.requestId,
      filename: req.file.originalname,
      size: req.file.size,
    });

    const { data, auditRunId } = await salesService.validateSales(req);

    return res.json({
      ...data,
      auditRunId,
    });
  } catch (err) {
    salesService.notifySalesFailure(req, err);
    return next(err);
  }
}

async function exportInvalid(req, res, next) {
  try {
    const parsed = validateSalesExportInvalidBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        detail: parsed.detail,
        requestId: req.requestId,
      });
    }

    logger.info('Sales export-invalid: forwarding to Python', {
      requestId: req.requestId,
      recordCount: parsed.records.length,
    });

    const { buffer, contentDisposition, contentType } = await salesService.exportInvalidSales(
      parsed.records,
      { requestId: req.requestId }
    );

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
      res.setHeader('Content-Disposition', contentDisposition);
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="sales-invalid-rows.xlsx"');
    }

    return res.send(buffer);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/v1/process/sales/product-average-rates
 * GET /api/sales-audit/product-average-rates (legacy compat)
 */
async function getProductAverageRates(req, res, next) {
  try {
    if (!req.user?.id) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const { rows, pagination, meta } = await salesService.getProductAverageRates(req.query);
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
 * GET /api/v1/process/sales/product-average-rates/export
 * GET /api/sales-audit/product-average-rates/export (legacy compat)
 */
async function exportProductAverageRates(req, res, next) {
  try {
    if (!req.user?.id) {
      return ErrorResponse(res, 401, 'Access token required');
    }

    const rows = await salesService.getProductAverageRatesForExport(req.query);
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
  validate,
  exportInvalid,
  getProductAverageRates,
  exportProductAverageRates,
};

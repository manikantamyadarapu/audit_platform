const pythonClient = require('./pythonClient.service');
const auditNotification = require('./auditNotification.service');
const { AUDIT_KEYS } = require('../constants/notifications');
const salesRepository = require('../repositories/sales.repository');
const logger = require('../utils/logger');

/**
 * Validate a Sales workbook: forward to Python, persist product averages
 * for the sales-return baseline, and fire completion/failure notifications.
 *
 * @param {import('express').Request} req
 * @returns {Promise<{ data: object, auditRunId: number | null }>}
 */
async function validateSales(req) {
  const { file, requestId, user } = req;

  const data = await pythonClient.postSalesValidate(file.buffer, file.originalname, file.mimetype, {
    requestId,
  });

  let auditRunId = null;
  if (user?.id) {
    try {
      auditRunId = await persistSalesAuditProductAverages({
        userId: user.id,
        fileName: file.originalname,
        pythonResult: data,
      });
    } catch (persistError) {
      logger.error('Sales audit product averages persist failed', {
        requestId,
        userId: user.id,
        message: persistError.message,
      });
    }
  }

  if (user?.id) {
    auditNotification.notifyAuditCompleted(user.id, AUDIT_KEYS.SALES, file.originalname, data).catch(() => {});
  }

  return { data, auditRunId };
}

/**
 * @param {import('express').Request} req
 * @param {Error} err
 */
function notifySalesFailure(req, err) {
  if (!req.user?.id) return;
  auditNotification
    .notifyAuditFailed(req.user.id, AUDIT_KEYS.SALES, req.file?.originalname, err.message)
    .catch(() => {});
}

/**
 * @param {object[]} records
 * @param {{ requestId?: string }} [options]
 */
async function exportInvalidSales(records, options = {}) {
  return pythonClient.postSalesExportInvalid(records, options);
}

function parseListQuery(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  const auditTypeRaw = String(query.auditType || 'SALES').trim().toUpperCase();

  return {
    page,
    limit,
    search: query.search?.trim() || undefined,
    salesAccount: query.salesAccount?.trim() || undefined,
    auditRunId: query.auditRunId ? Number(query.auditRunId) : undefined,
    auditType: auditTypeRaw === 'PURCHASE' ? 'PURCHASE' : 'SALES',
    uploadedBy: query.uploadedBy != null ? Number(query.uploadedBy) : undefined,
    sortBy,
    sortOrder,
  };
}

/**
 * @param {{ userId?: number, fileName?: string, pythonResult: object }} params
 * @returns {Promise<number | null>}
 */
async function persistSalesAuditProductAverages({ userId, fileName, pythonResult }) {
  if (!userId) return null;

  const productAverages = pythonResult?.productAverages ?? [];
  const auditRun = await salesRepository.createAuditRunWithProductAverages({
    uploadedBy: userId,
    fileName,
    totalRows: pythonResult?.totalRows ?? 0,
    invalidRows: pythonResult?.errorRows ?? 0,
    productAverages,
    pythonResult,
  });

  return auditRun.id;
}

/**
 * @param {Record<string, unknown>} query
 */
async function getProductAverageRates(query, user) {
  const filters = parseListQuery(query);
  const role = String(user?.role || '').toUpperCase();
  if (!['ADMIN', 'SUPER_ADMIN'].includes(role) && user?.id) {
    filters.uploadedBy = user.id;
  }
  return salesRepository.findProductAverageRates(filters);
}

/**
 * @param {Record<string, unknown>} query
 * @param {{ id?: number, role?: string }} [user]
 */
async function getProductAverageRatesForExport(query, user) {
  const filters = parseListQuery({ ...query, page: 1, limit: 100000 });
  const role = String(user?.role || '').toUpperCase();
  if (!['ADMIN', 'SUPER_ADMIN'].includes(role) && user?.id) {
    filters.uploadedBy = user.id;
  }
  return salesRepository.findAllProductAverageRatesForExport(filters);
}

module.exports = {
  validateSales,
  notifySalesFailure,
  exportInvalidSales,
  persistSalesAuditProductAverages,
  getProductAverageRates,
  getProductAverageRatesForExport,
};

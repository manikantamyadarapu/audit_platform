const salesProductAverageRepository = require('../repositories/salesProductAverage.repository');

function parseListQuery(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    search: query.search?.trim() || undefined,
    salesAccount: query.salesAccount?.trim() || undefined,
    auditRunId: query.auditRunId ? Number(query.auditRunId) : undefined,
    sortBy,
    sortOrder,
  };
}

async function persistSalesAuditProductAverages({
  userId,
  fileName,
  pythonResult,
}) {
  if (!userId) return null;

  const productAverages = pythonResult?.productAverages ?? [];
  const auditRun = await salesProductAverageRepository.createAuditRunWithProductAverages({
    uploadedBy: userId,
    fileName,
    totalRows: pythonResult?.totalRows ?? 0,
    invalidRows: pythonResult?.errorRows ?? 0,
    productAverages,
    pythonResult,
  });

  return auditRun.id;
}

async function getProductAverageRates(query) {
  const filters = parseListQuery(query);
  return salesProductAverageRepository.findProductAverageRates(filters);
}

async function getProductAverageRatesForExport(query) {
  const filters = parseListQuery({ ...query, page: 1, limit: 100000 });
  return salesProductAverageRepository.findAllProductAverageRatesForExport(filters);
}

module.exports = {
  persistSalesAuditProductAverages,
  getProductAverageRates,
  getProductAverageRatesForExport,
};

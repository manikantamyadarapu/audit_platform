const auditRunRepository = require('./auditRun.repository');
const { extractIssueCounts, extractMetrics } = require('../services/auditRunPersistence.service');

const prisma = require('../lib/prisma');

const SORT_FIELDS = {
  product: 'product',
  salesAccount: 'salesAccount',
  totalQuantity: 'totalQuantity',
  totalGrossAmount: 'totalGrossAmount',
  averageRate: 'averageRate',
  transactionCount: 'transactionCount',
  createdAt: 'createdAt',
};

function toNumber(value) {
  if (value == null) return null;
  return Number(value);
}

function mapRow(row) {
  return {
    id: row.id,
    auditRunId: row.auditRunId,
    product: row.product,
    salesAccount: row.salesAccount,
    totalQuantity: toNumber(row.totalQuantity),
    totalGrossAmount: toNumber(row.totalGrossAmount),
    averageRate: toNumber(row.averageRate),
    transactionCount: row.transactionCount,
    createdAt: row.createdAt,
    fileName: row.auditRun?.fileName ?? null,
  };
}

async function findSalesAuditTypeId() {
  const auditType = await prisma.auditType.findUnique({
    where: { auditCode: 'SALES' },
    select: { id: true },
  });
  return auditType?.id ?? null;
}

function dedupeProductAverages(rows) {
  const merged = new Map();
  for (const row of rows ?? []) {
    const product = String(row.product || '').trim();
    const productNorm = String(row.productNorm || product).trim().toUpperCase();
    if (!productNorm) continue;

    const existing = merged.get(productNorm);
    if (!existing) {
      merged.set(productNorm, {
        product,
        productNorm,
        salesAccount: String(row.salesAccount || '').trim(),
        totalQuantity: Number(row.totalQuantity) || 0,
        totalGrossAmount: Number(row.totalGrossAmount) || 0,
        transactionCount: Number(row.transactionCount) || 0,
      });
      continue;
    }

    existing.totalQuantity += Number(row.totalQuantity) || 0;
    existing.totalGrossAmount += Number(row.totalGrossAmount) || 0;
    existing.transactionCount += Number(row.transactionCount) || 0;
    if (!existing.salesAccount && row.salesAccount) {
      existing.salesAccount = String(row.salesAccount).trim();
    }
  }

  return [...merged.values()].map((row) => ({
    ...row,
    averageRate:
      row.totalQuantity > 0 ? Number((row.totalGrossAmount / row.totalQuantity).toFixed(4)) : 0,
  }));
}

function buildVerificationSummary(rows, totalRowsProcessed = 0) {
  const buckets = {
    diRaProducts: 0,
    diRcProducts: 0,
    flatPolkiProducts: 0,
    polkiProducts: 0,
    chakriProducts: 0,
    goldProducts: 0,
    silverProducts: 0,
    emeraldProducts: 0,
    rubyProducts: 0,
    colorStoneProducts: 0,
    pearlProducts: 0,
    otherProducts: 0,
  };

  const familyFor = (name) => {
    const upper = String(name || '').toUpperCase().trim();
    if (!upper) return 'otherProducts';
    if (/^DI\.?\s*RA\b/.test(upper)) return 'diRaProducts';
    if (/^DI\.?\s*RC\b/.test(upper)) return 'diRcProducts';
    if (upper.includes('FLAT POLKI') || upper.startsWith('FP ')) return 'flatPolkiProducts';
    if (upper.includes('POLKI')) return 'polkiProducts';
    if (upper === 'CHAKRI' || upper.startsWith('CHAKRI ')) return 'chakriProducts';
    if (upper.includes('GOLD') || /\b\d{1,2}K\b/.test(upper)) return 'goldProducts';
    if (upper.includes('SILVER')) return 'silverProducts';
    if (upper.includes('EMERALD') || /^JEM\b/.test(upper)) return 'emeraldProducts';
    if (upper.includes('RUBY') || upper.includes('RUBIES')) return 'rubyProducts';
    if (upper.includes('COLOR STONE') || upper.includes('COLOUR STONE')) return 'colorStoneProducts';
    if (upper.includes('PEARL')) return 'pearlProducts';
    return 'otherProducts';
  };

  for (const row of rows) {
    buckets[familyFor(row.productNorm || row.product)] += 1;
  }

  return {
    totalRowsProcessed,
    totalDistinctProducts: rows.length,
    ...buckets,
  };
}

async function createAuditRunWithProductAverages({
  uploadedBy,
  fileName,
  totalRows,
  invalidRows,
  productAverages,
  pythonResult,
}) {
  const auditTypeId = await auditRunRepository.resolveAuditTypeId('SALES');
  if (!auditTypeId) {
    throw new Error('SALES audit type is not configured');
  }

  const metrics = pythonResult ? extractMetrics(pythonResult) : { totalRows, invalidRows };
  const issueCounts = pythonResult ? extractIssueCounts(pythonResult) : [];

  // Build resultSummary for sales audit
  const resultSummary = {
    issueCounts: issueCounts,
    productRates: productAverages?.length ? dedupeProductAverages(productAverages) : [],
  };

  const auditRun = await auditRunRepository.createAuditRun({
    auditTypeId,
    uploadedBy,
    fileName: fileName || 'sales-audit.xlsx',
    totalRows: metrics.totalRows ?? totalRows ?? 0,
    invalidRows: metrics.invalidRows ?? invalidRows ?? 0,
    resultSummary,
  });

  return auditRun;
}

async function findProductAverageRates({
  page = 1,
  limit = 25,
  search,
  salesAccount,
  auditRunId,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const orderField = SORT_FIELDS[sortBy] || 'createdAt';
  const orderDir = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

  let auditRunMeta = null;
  let productRates = [];

  if (auditRunId) {
    auditRunMeta = await prisma.auditRun.findUnique({
      where: { id: Number(auditRunId) },
      select: { id: true, fileName: true, totalRows: true, createdAt: true, resultSummary: true },
    });
    if (auditRunMeta?.resultSummary?.productRates) {
      productRates = auditRunMeta.resultSummary.productRates;
    }
  } else {
    const auditTypeId = await findSalesAuditTypeId();
    auditRunMeta = auditTypeId
      ? await prisma.auditRun.findFirst({
          where: { auditTypeId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, fileName: true, totalRows: true, createdAt: true, resultSummary: true },
        })
      : null;
    if (auditRunMeta?.resultSummary?.productRates) {
      productRates = auditRunMeta.resultSummary.productRates;
    }
  }

  // Filter by search and salesAccount
  let filteredRates = productRates;
  if (salesAccount?.trim()) {
    filteredRates = filteredRates.filter(row => 
      row.salesAccount?.toLowerCase().includes(salesAccount.trim().toLowerCase())
    );
  }
  if (search?.trim()) {
    filteredRates = filteredRates.filter(row => 
      row.product?.toLowerCase().includes(search.trim().toLowerCase()) ||
      row.salesAccount?.toLowerCase().includes(search.trim().toLowerCase())
    );
  }

  // Sort
  filteredRates.sort((a, b) => {
    const aVal = a[orderField] || 0;
    const bVal = b[orderField] || 0;
    return orderDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  // Paginate
  const total = filteredRates.length;
  const skip = (safePage - 1) * safeLimit;
  const paginatedRates = filteredRates.slice(skip, skip + safeLimit);

  const verification = buildVerificationSummary(
    productRates.map((row) => ({ product: row.product })),
    auditRunMeta?.totalRows ?? 0
  );

  return {
    rows: paginatedRates.map(row => ({
      ...row,
      auditRunId: auditRunMeta?.id,
      fileName: auditRunMeta?.fileName,
      createdAt: auditRunMeta?.createdAt,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    meta: {
      auditRunId: auditRunMeta?.id ?? null,
      fileName: auditRunMeta?.fileName ?? null,
      auditRunCreatedAt: auditRunMeta?.createdAt ?? null,
      verification,
    },
  };
}

async function findLatestSalesAuditProductAverages() {
  const auditTypeId = await findSalesAuditTypeId();
  if (!auditTypeId) {
    return { auditRun: null, rows: [] };
  }

  const latestRun = await prisma.auditRun.findFirst({
    where: {
      auditTypeId,
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      createdAt: true,
      resultSummary: true,
    },
  });

  if (!latestRun) {
    return { auditRun: null, rows: [] };
  }

  const productRates = latestRun.resultSummary?.productRates || [];
  const rows = productRates.map(row => ({
    ...row,
    auditRunId: latestRun.id,
    fileName: latestRun.fileName,
    createdAt: latestRun.createdAt,
  }));

  return {
    auditRun: latestRun,
    rows,
  };
}

async function findAllProductAverageRatesForExport(filters = {}) {
  const { search, salesAccount, auditRunId, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
  const orderField = SORT_FIELDS[sortBy] || 'createdAt';
  const orderDir = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

  let auditRunMeta = null;
  let productRates = [];

  if (auditRunId) {
    auditRunMeta = await prisma.auditRun.findUnique({
      where: { id: Number(auditRunId) },
      select: { id: true, fileName: true, resultSummary: true },
    });
    if (auditRunMeta?.resultSummary?.productRates) {
      productRates = auditRunMeta.resultSummary.productRates;
    }
  } else {
    const auditTypeId = await findSalesAuditTypeId();
    const latestRun = auditTypeId
      ? await prisma.auditRun.findFirst({
          where: { auditTypeId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, fileName: true, resultSummary: true },
        })
      : null;
    if (latestRun?.resultSummary?.productRates) {
      productRates = latestRun.resultSummary.productRates;
      auditRunMeta = latestRun;
    }
  }

  // Filter by search and salesAccount
  let filteredRates = productRates;
  if (salesAccount?.trim()) {
    filteredRates = filteredRates.filter(row => 
      row.salesAccount?.toLowerCase().includes(salesAccount.trim().toLowerCase())
    );
  }
  if (search?.trim()) {
    filteredRates = filteredRates.filter(row => 
      row.product?.toLowerCase().includes(search.trim().toLowerCase()) ||
      row.salesAccount?.toLowerCase().includes(search.trim().toLowerCase())
    );
  }

  // Sort
  filteredRates.sort((a, b) => {
    const aVal = a[orderField] || 0;
    const bVal = b[orderField] || 0;
    return orderDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return filteredRates.map(row => ({
    ...row,
    fileName: auditRunMeta?.fileName,
  }));
}

module.exports = {
  createAuditRunWithProductAverages,
  findProductAverageRates,
  findLatestSalesAuditProductAverages,
  findAllProductAverageRatesForExport,
};

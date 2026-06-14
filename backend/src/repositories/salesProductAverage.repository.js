const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
}) {
  const auditTypeId = await findSalesAuditTypeId();
  if (!auditTypeId) {
    throw new Error('SALES audit type is not configured');
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const auditRun = await tx.auditRun.create({
      data: {
        auditTypeId,
        fileName: fileName || 'sales-audit.xlsx',
        uploadedBy,
        status: 'COMPLETED',
        totalRows: totalRows ?? 0,
        invalidRows: invalidRows ?? 0,
        startedAt: now,
        completedAt: now,
      },
    });

    if (productAverages?.length) {
      const deduped = dedupeProductAverages(productAverages);
      await tx.salesProductAverageRate.createMany({
        data: deduped.map((row) => ({
          auditRunId: auditRun.id,
          product: String(row.product || '').slice(0, 255),
          salesAccount: String(row.salesAccount || '').slice(0, 255),
          totalQuantity: row.totalQuantity ?? 0,
          totalGrossAmount: row.totalGrossAmount ?? 0,
          averageRate: row.averageRate ?? 0,
          transactionCount: Number(row.transactionCount) || 0,
        })),
      });
    }

    return auditRun;
  });
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
  const skip = (safePage - 1) * safeLimit;
  const orderField = SORT_FIELDS[sortBy] || 'createdAt';
  const orderDir = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

  /** @type {import('@prisma/client').Prisma.SalesProductAverageRateWhereInput} */
  const where = {};
  let auditRunMeta = null;

  if (auditRunId) {
    where.auditRunId = Number(auditRunId);
    auditRunMeta = await prisma.auditRun.findUnique({
      where: { id: Number(auditRunId) },
      select: { id: true, fileName: true, totalRows: true, createdAt: true },
    });
  } else {
    const auditTypeId = await findSalesAuditTypeId();
    auditRunMeta = auditTypeId
      ? await prisma.auditRun.findFirst({
          where: { auditTypeId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, fileName: true, totalRows: true, createdAt: true },
        })
      : null;
    if (auditRunMeta) {
      where.auditRunId = auditRunMeta.id;
    }
  }

  if (salesAccount?.trim()) {
    where.salesAccount = { contains: salesAccount.trim(), mode: 'insensitive' };
  }

  if (search?.trim()) {
    where.OR = [
      { product: { contains: search.trim(), mode: 'insensitive' } },
      { salesAccount: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [rows, total, allProductsForSummary] = await Promise.all([
    prisma.salesProductAverageRate.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { [orderField]: orderDir },
      include: {
        auditRun: {
          select: { fileName: true, createdAt: true },
        },
      },
    }),
    prisma.salesProductAverageRate.count({ where }),
    where.auditRunId
      ? prisma.salesProductAverageRate.findMany({
          where: { auditRunId: where.auditRunId },
          select: { product: true },
          orderBy: { product: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  const verification = buildVerificationSummary(
    allProductsForSummary.map((row) => ({ product: row.product })),
    auditRunMeta?.totalRows ?? 0
  );

  return {
    rows: rows.map(mapRow),
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
    },
  });

  if (!latestRun) {
    return { auditRun: null, rows: [] };
  }

  const rows = await prisma.salesProductAverageRate.findMany({
    where: { auditRunId: latestRun.id },
    orderBy: { product: 'asc' },
  });

  return {
    auditRun: latestRun,
    rows: rows.map(mapRow),
  };
}

async function findAllProductAverageRatesForExport(filters = {}) {
  const { search, salesAccount, auditRunId, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
  const orderField = SORT_FIELDS[sortBy] || 'createdAt';
  const orderDir = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

  /** @type {import('@prisma/client').Prisma.SalesProductAverageRateWhereInput} */
  const where = {};
  if (auditRunId) {
    where.auditRunId = Number(auditRunId);
  } else {
    const auditTypeId = await findSalesAuditTypeId();
    const latestRun = auditTypeId
      ? await prisma.auditRun.findFirst({
          where: { auditTypeId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        })
      : null;
    if (latestRun) {
      where.auditRunId = latestRun.id;
    }
  }
  if (salesAccount?.trim()) {
    where.salesAccount = { contains: salesAccount.trim(), mode: 'insensitive' };
  }
  if (search?.trim()) {
    where.OR = [
      { product: { contains: search.trim(), mode: 'insensitive' } },
      { salesAccount: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.salesProductAverageRate.findMany({
    where,
    orderBy: { [orderField]: orderDir },
    include: { auditRun: { select: { fileName: true } } },
  });
  return rows.map(mapRow);
}

module.exports = {
  createAuditRunWithProductAverages,
  findProductAverageRates,
  findLatestSalesAuditProductAverages,
  findAllProductAverageRatesForExport,
};

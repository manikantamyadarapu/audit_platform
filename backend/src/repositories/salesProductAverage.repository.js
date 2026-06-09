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
      await tx.salesProductAverageRate.createMany({
        data: productAverages.map((row) => ({
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

  if (auditRunId) {
    where.auditRunId = Number(auditRunId);
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

  const [rows, total] = await Promise.all([
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
  ]);

  return {
    rows: rows.map(mapRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
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
  if (auditRunId) where.auditRunId = Number(auditRunId);
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

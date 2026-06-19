const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Build Prisma createdAt filter.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} [exclusiveEnd=false] - use `lt` instead of `lte` (avoids overlap at period boundary)
 */
function createdAtRange(startDate, endDate, exclusiveEnd = false) {
  const filter = { gte: startDate };
  if (exclusiveEnd) {
    filter.lt = endDate;
  } else {
    filter.lte = endDate;
  }
  return filter;
}

/**
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} [exclusiveEnd=false]
 * @returns {Promise<number>}
 */
async function getTotalAudits(startDate, endDate, exclusiveEnd = false) {
  const count = await prisma.auditRun.count({
    where: {
      createdAt: createdAtRange(startDate, endDate, exclusiveEnd),
    },
  });
  return count;
}

/**
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} [exclusiveEnd=false]
 * @returns {Promise<number>}
 */
async function getTotalRecords(startDate, endDate, exclusiveEnd = false) {
  const result = await prisma.auditRun.aggregate({
    where: {
      createdAt: createdAtRange(startDate, endDate, exclusiveEnd),
    },
    _sum: {
      totalRows: true,
    },
  });
  return result._sum.totalRows ?? 0;
}

/**
 * Primary: SUM(issue_count) from audit_issue_counts for runs in range.
 * Fallback: SUM(invalid_rows) from audit_runs when no issue count rows exist.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} [exclusiveEnd=false]
 * @returns {Promise<number>}
 */
async function getTotalIssues(startDate, endDate, exclusiveEnd = false) {
  const dateFilter = createdAtRange(startDate, endDate, exclusiveEnd);

  const [issueCountRows, issueAggregate, invalidAggregate] = await Promise.all([
    prisma.auditIssueCount.count({
      where: {
        auditRun: {
          createdAt: dateFilter,
        },
      },
    }),
    prisma.auditIssueCount.aggregate({
      where: {
        auditRun: {
          createdAt: dateFilter,
        },
      },
      _sum: {
        issueCount: true,
      },
    }),
    prisma.auditRun.aggregate({
      where: {
        createdAt: dateFilter,
      },
      _sum: {
        invalidRows: true,
      },
    }),
  ]);

  if (issueCountRows > 0) {
    return issueAggregate._sum.issueCount ?? 0;
  }

  return invalidAggregate._sum.invalidRows ?? 0;
}

/**
 * Issue total for a single run (issue_counts primary, invalid_rows fallback).
 * @param {{ invalidRows?: number, issueCounts?: Array<{ issueCount: number }> }} run
 * @returns {number}
 */
function resolveRunIssueTotal(run) {
  if (run.issueCounts && run.issueCounts.length > 0) {
    return run.issueCounts.reduce((sum, row) => sum + (row.issueCount ?? 0), 0);
  }
  return run.invalidRows ?? 0;
}

/**
 * Fetch audit runs with issue counts in a date range (single query, no N+1).
 * @param {Date} startDate
 * @param {Date} [endDate]
 * @returns {Promise<Array<{ id: number, createdAt: Date, invalidRows: number, issueCounts: Array<{ issueCount: number }> }>>}
 */
async function fetchAuditRunsWithIssues(startDate, endDate = new Date()) {
  return prisma.auditRun.findMany({
    where: {
      createdAt: createdAtRange(startDate, endDate),
    },
    select: {
      id: true,
      createdAt: true,
      invalidRows: true,
      issueCounts: {
        select: {
          issueCount: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * @param {Date} startDate
 * @returns {Promise<Array<{ id: number, createdAt: Date, invalidRows: number, issueCounts: Array<{ issueCount: number }> }>>}
 */
async function getDailyTrend(startDate) {
  return fetchAuditRunsWithIssues(startDate);
}

/**
 * @param {Date} startDate
 * @returns {Promise<Array<{ id: number, createdAt: Date, invalidRows: number, issueCounts: Array<{ issueCount: number }> }>>}
 */
async function getWeeklyTrend(startDate) {
  return fetchAuditRunsWithIssues(startDate);
}

/**
 * @param {Date} startDate
 * @returns {Promise<Array<{ id: number, createdAt: Date, invalidRows: number, issueCounts: Array<{ issueCount: number }> }>>}
 */
async function getMonthlyTrend(startDate) {
  return fetchAuditRunsWithIssues(startDate);
}

/**
 * Aggregate issue counts by issue code and name for audit runs in date range.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{ issueCode: string, issueName: string, _sum: { issueCount: number | null } }>>}
 */
async function getIssuesByCategory(startDate, endDate) {
  return prisma.auditIssueCount.groupBy({
    by: ['issueCode', 'issueName'],
    where: {
      auditRun: {
        createdAt: createdAtRange(startDate, endDate),
      },
    },
    _sum: {
      issueCount: true,
    },
    orderBy: {
      _sum: {
        issueCount: 'desc',
      },
    },
  });
}

/**
 * Paginated recent audit uploads with audit type join.
 * @param {{
 *   page: number,
 *   limit: number,
 *   status?: string,
 *   auditType?: number,
 *   search?: string,
 * }} filters
 * @returns {Promise<{ runs: Array<{ id: number, fileName: string, totalRows: number, createdAt: Date, status: string, auditType: { auditName: string } }>, total: number }>}
 */
async function getRecentAudits(filters) {
  const { page, limit, status, auditType, search, startDate, endDate } = filters;
  const skip = (page - 1) * limit;

  /** @type {import('@prisma/client').Prisma.AuditRunWhereInput} */
  const where = {};

  if (startDate && endDate) {
    where.createdAt = createdAtRange(startDate, endDate);
  }

  if (status) {
    where.status = status;
  }

  if (auditType != null) {
    where.auditTypeId = auditType;
  }

  if (search) {
    where.fileName = {
      contains: search,
      mode: 'insensitive',
    };
  }

  const [runs, total] = await Promise.all([
    prisma.auditRun.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        fileName: true,
        totalRows: true,
        createdAt: true,
        status: true,
        auditType: {
          select: {
            auditName: true,
          },
        },
      },
    }),
    prisma.auditRun.count({ where }),
  ]);

  return { runs, total };
}

module.exports = {
  getTotalAudits,
  getTotalRecords,
  getTotalIssues,
  resolveRunIssueTotal,
  getDailyTrend,
  getWeeklyTrend,
  getMonthlyTrend,
  getIssuesByCategory,
  getRecentAudits,
};

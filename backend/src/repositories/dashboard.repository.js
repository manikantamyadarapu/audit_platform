const prisma = require('../lib/prisma');

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
async function getTotalAudits(startDate, endDate, exclusiveEnd = false, uploadedBy) {
  /** @type {import('@prisma/client').Prisma.AuditRunWhereInput} */
  const where = {
    createdAt: createdAtRange(startDate, endDate, exclusiveEnd),
  };
  if (uploadedBy != null) {
    where.uploadedBy = Number(uploadedBy);
  }
  const count = await prisma.auditRun.count({ where });
  return count;
}

/**
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} [exclusiveEnd=false]
 * @param {number} [uploadedBy]
 * @returns {Promise<number>}
 */
async function getTotalRecords(startDate, endDate, exclusiveEnd = false, uploadedBy) {
  /** @type {import('@prisma/client').Prisma.AuditRunWhereInput} */
  const where = {
    createdAt: createdAtRange(startDate, endDate, exclusiveEnd),
  };
  if (uploadedBy != null) {
    where.uploadedBy = Number(uploadedBy);
  }
  const result = await prisma.auditRun.aggregate({
    where,
    _sum: {
      totalRows: true,
    },
  });
  return result._sum.totalRows ?? 0;
}

/**
 * Primary: Extract total issues from resultSummary JSON field.
 * Fallback: SUM(invalid_rows) from audit_runs when resultSummary is null.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} [exclusiveEnd=false]
 * @param {number} [uploadedBy]
 * @returns {Promise<number>}
 */
async function getTotalIssues(startDate, endDate, exclusiveEnd = false, uploadedBy) {
  const dateFilter = createdAtRange(startDate, endDate, exclusiveEnd);
  /** @type {import('@prisma/client').Prisma.AuditRunWhereInput} */
  const where = { createdAt: dateFilter };
  if (uploadedBy != null) {
    where.uploadedBy = Number(uploadedBy);
  }

  const auditRuns = await prisma.auditRun.findMany({
    where,
    select: {
      resultSummary: true,
      invalidRows: true,
    },
  });

  let totalIssues = 0;
  for (const run of auditRuns) {
    if (run.resultSummary && typeof run.resultSummary === 'object') {
      const summary = run.resultSummary;
      if (summary.issueCounts && Array.isArray(summary.issueCounts)) {
        totalIssues += summary.issueCounts.reduce((sum, issue) => sum + (issue.count || 0), 0);
      } else if (summary.grossMismatchCount) {
        totalIssues += summary.grossMismatchCount;
      } else if (summary.goldDeviationCount) {
        totalIssues += summary.goldDeviationCount;
      }
    } else {
      totalIssues += run.invalidRows || 0;
    }
  }

  return totalIssues;
}

/**
 * Issue total for a single run (resultSummary primary, invalidRows fallback).
 * @param {{ invalidRows?: number, resultSummary?: object }} run
 * @returns {number}
 */
function resolveRunIssueTotal(run) {
  if (run.resultSummary && typeof run.resultSummary === 'object') {
    const summary = run.resultSummary;
    if (summary.issueCounts && Array.isArray(summary.issueCounts)) {
      return summary.issueCounts.reduce((sum, issue) => sum + (issue.count || 0), 0);
    } else if (summary.grossMismatchCount) {
      return summary.grossMismatchCount;
    } else if (summary.goldDeviationCount) {
      return summary.goldDeviationCount;
    }
  }
  return run.invalidRows ?? 0;
}

/**
 * Fetch audit runs with resultSummary in a date range (single query, no N+1).
 * @param {Date} startDate
 * @param {Date} [endDate]
 * @returns {Promise<Array<{ id: number, createdAt: Date, invalidRows: number, resultSummary: object }>>}
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
      resultSummary: true,
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
 * Extracts from resultSummary JSON field.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Array<{ issueCode: string, issueName: string, count: number }>>}
 */
async function getIssuesByCategory(startDate, endDate) {
  const auditRuns = await prisma.auditRun.findMany({
    where: {
      createdAt: createdAtRange(startDate, endDate),
    },
    select: {
      resultSummary: true,
    },
  });

  const issueMap = new Map();
  
  for (const run of auditRuns) {
    if (run.resultSummary && typeof run.resultSummary === 'object') {
      const summary = run.resultSummary;
      if (summary.issueCounts && Array.isArray(summary.issueCounts)) {
        for (const issue of summary.issueCounts) {
          const key = `${issue.code}_${issue.name}`;
          const existing = issueMap.get(key) || { code: issue.code, name: issue.name, count: 0 };
          existing.count += issue.count || 0;
          issueMap.set(key, existing);
        }
      }
    }
  }

  return Array.from(issueMap.values()).sort((a, b) => b.count - a.count);
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
  const { page, limit, status, auditType, search, startDate, endDate, uploadedBy } = filters;
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

  if (uploadedBy != null) {
    where.uploadedBy = Number(uploadedBy);
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

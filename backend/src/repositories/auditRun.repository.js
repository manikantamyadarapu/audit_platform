const prisma = require('../lib/prisma');

const DEFAULT_AUDIT_TYPES = {
  SALES: {
    auditName: 'Rate & Ledger Audit',
    description: 'Sales rate and ledger validation',
  },
  PURCHASE: {
    auditName: 'Purchase Rate & Ledger Audit',
    description: 'Purchase rate and ledger validation',
  },
  SALES_RETURN: {
    auditName: 'Sales Return Audit',
    description: 'Sales return validation and rate comparison',
  },
  PURCHASE_RETURN: {
    auditName: 'Purchase Return Audit',
    description: 'Purchase return validation and rate comparison',
  },
  PAN: {
    auditName: 'ID Proof Audit',
    description: 'PAN and address proof validation',
  },
  GROSS: {
    auditName: 'Gross Weight Audit',
    description: 'Gross weight mismatch validation',
  },
  FINANCIALS_PIVOT: {
    auditName: 'Closing Stock Audit',
    description: 'Financials closing stock pivot and opening stock validation',
  },
};

const CODE_ALIASES = {
  GROSS_WEIGHT: 'GROSS',
  PAN_AUDIT: 'PAN',
};

/**
 * @param {string} auditCode
 * @returns {Promise<number | null>}
 */
async function resolveAuditTypeId(auditCode) {
  let code = String(auditCode || '').trim().toUpperCase();
  if (!code) return null;
  if (CODE_ALIASES[code]) {
    code = CODE_ALIASES[code];
  }

  const candidates = new Set([code]);
  for (const [alias, canonical] of Object.entries(CODE_ALIASES)) {
    if (canonical === code) candidates.add(alias);
    if (alias === code) candidates.add(canonical);
  }

  for (const candidate of candidates) {
    const existing = await prisma.auditType.findUnique({
      where: { auditCode: candidate },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const definition = DEFAULT_AUDIT_TYPES[code];
  if (!definition) return null;

  const created = await prisma.auditType.create({
    data: {
      auditCode: code,
      auditName: definition.auditName,
      description: definition.description,
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * @param {{
 *   auditTypeId: number,
 *   uploadedBy: number,
 *   fileName?: string,
 *   totalRows?: number,
 *   invalidRows?: number,
 *   resultSummary?: object,
 *   performanceMetrics?: object,
 *   fileMetadata?: object,
 * }} params
 */
async function createAuditRun({
  auditTypeId,
  uploadedBy,
  fileName,
  totalRows,
  invalidRows,
  resultSummary,
  performanceMetrics,
  fileMetadata,
}) {
  const now = new Date();

  const data = {
    auditTypeId,
    fileName: String(fileName || 'audit.xlsx').slice(0, 255),
    uploadedBy,
    status: 'COMPLETED',
    totalRows: Number(totalRows) || 0,
    invalidRows: Number(invalidRows) || 0,
    startedAt: now,
    completedAt: now,
  };

  // Add resultSummary if provided
  if (resultSummary) {
    data.resultSummary = resultSummary;
  }

  // Add performance metrics if provided
  if (performanceMetrics) {
    data.processingTimeMs = performanceMetrics.processingTimeMs;
    data.memoryUsageMb = performanceMetrics.memoryUsageMb;
    data.rowsPerSecond = performanceMetrics.rowsPerSecond;
    data.cpuUsagePercent = performanceMetrics.cpuUsagePercent;
  }

  // Add file metadata if provided
  if (fileMetadata) {
    data.originalName = fileMetadata.originalName;
    data.storagePath = fileMetadata.storagePath;
    data.fileHash = fileMetadata.fileHash;
    data.fileSize = fileMetadata.fileSize;
  }

  return prisma.auditRun.create({
    data,
  });
}

module.exports = {
  resolveAuditTypeId,
  createAuditRun,
};

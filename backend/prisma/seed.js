const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('Start seeding...');

  // ============================================================================
  // 1. SEED ROLES
  // ============================================================================
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { roleName: 'ADMIN' },
      update: {},
      create: {
        roleName: 'ADMIN',
        description: 'Administrator with full access',
      },
    }),
    prisma.role.upsert({
      where: { roleName: 'AUDITOR' },
      update: {},
      create: {
        roleName: 'AUDITOR',
        description: 'Can run audits and view reports',
      },
    }),
    prisma.role.upsert({
      where: { roleName: 'VIEWER' },
      update: {},
      create: {
        roleName: 'VIEWER',
        description: 'Read-only access to reports',
      },
    }),
    prisma.role.upsert({
      where: { roleName: 'SUPER_ADMIN' },
      update: {},
      create: {
        roleName: 'SUPER_ADMIN',
        description: 'Super administrator with system access',
      },
    }),
  ]);
  console.log(`Created ${roles.length} roles`);

  const adminRole = roles.find(r => r.roleName === 'ADMIN');
  const auditorRole = roles.find(r => r.roleName === 'AUDITOR');

  // ============================================================================
  // 2. SEED AUDIT TYPES
  // ============================================================================
  const auditTypes = await Promise.all([
    prisma.auditType.upsert({
      where: { auditCode: 'SALES' },
      update: {},
      create: {
        auditCode: 'SALES',
        auditName: 'Sales Audit',
        description: 'Sales ledger validation and verification',
        isActive: true,
      },
    }),
    prisma.auditType.upsert({
      where: { auditCode: 'GROSS' },
      update: {},
      create: {
        auditCode: 'GROSS',
        auditName: 'Gross Weight Audit',
        description: 'Gross weight validation (gross = net + stone)',
        isActive: true,
      },
    }),
    prisma.auditType.upsert({
      where: { auditCode: 'RATE' },
      update: {},
      create: {
        auditCode: 'RATE',
        auditName: 'Rate Verification',
        description: 'Rate validation against master rules',
        isActive: true,
      },
    }),
    prisma.auditType.upsert({
      where: { auditCode: 'PAN' },
      update: {},
      create: {
        auditCode: 'PAN',
        auditName: 'PAN Audit',
        description: 'PAN number validation',
        isActive: true,
      },
    }),
    prisma.auditType.upsert({
      where: { auditCode: 'AADHAR' },
      update: {},
      create: {
        auditCode: 'AADHAR',
        auditName: 'Aadhaar Audit',
        description: 'Aadhaar number validation',
        isActive: true,
      },
    }),
    prisma.auditType.upsert({
      where: { auditCode: 'GST' },
      update: {},
      create: {
        auditCode: 'GST',
        auditName: 'GST Audit',
        description: 'GST number validation',
        isActive: true,
      },
    }),
    prisma.auditType.upsert({
      where: { auditCode: 'UOM' },
      update: {},
      create: {
        auditCode: 'UOM',
        auditName: 'UOM Audit',
        description: 'Unit of Measure validation',
        isActive: true,
      },
    }),
    prisma.auditType.upsert({
      where: { auditCode: 'SALES_RETURN' },
      update: {},
      create: {
        auditCode: 'SALES_RETURN',
        auditName: 'Sales Return Audit',
        description: 'Sales return validation and rate comparison',
        isActive: true,
      },
    }),
  ]);
  console.log(`Created ${auditTypes.length} audit types`);

  const grossType = auditTypes.find(t => t.auditCode === 'GROSS');
  const rateType = auditTypes.find(t => t.auditCode === 'RATE');
  const panType = auditTypes.find(t => t.auditCode === 'PAN');
  const salesType = auditTypes.find(t => t.auditCode === 'SALES');

  // ============================================================================
  // 3. SEED MASTER RULES
  // ============================================================================
  const masterRules = await Promise.all([
    // Gold Rate Rules
    prisma.masterRule.create({
      data: {
        auditTypeId: rateType.id,
        ruleName: 'Gold 22K Rate Rule',
        productNorm: 'GOLD_22K',
        minValue: 5500.00,
        maxValue: 6500.00,
        variationPercent: 15.00,
        isActive: true,
      },
    }),
    prisma.masterRule.create({
      data: {
        auditTypeId: rateType.id,
        ruleName: 'Gold 24K Rate Rule',
        productNorm: 'GOLD_24K',
        minValue: 6000.00,
        maxValue: 7000.00,
        variationPercent: 10.00,
        isActive: true,
      },
    }),
    // Silver Rate Rule
    prisma.masterRule.create({
      data: {
        auditTypeId: rateType.id,
        ruleName: 'Silver 925 Rate Rule',
        productNorm: 'SILVER_925',
        minValue: 70.00,
        maxValue: 90.00,
        variationPercent: 15.00,
        isActive: true,
      },
    }),
    // Diamond Rate Rule
    prisma.masterRule.create({
      data: {
        auditTypeId: rateType.id,
        ruleName: 'Diamond VS1 Rate Rule',
        productNorm: 'DIAMOND_VS1',
        minValue: 50000.00,
        maxValue: 150000.00,
        variationPercent: 20.00,
        isActive: true,
      },
    }),
    // Gross Weight Rule
    prisma.masterRule.create({
      data: {
        auditTypeId: grossType.id,
        ruleName: 'Gross Weight Validation',
        productNorm: 'GROSS_WEIGHT_CHECK',
        ruleConfig: { formula: 'gross = net + stone', tolerance: 0.01 },
        isActive: true,
      },
    }),
    // PAN Format Rule
    prisma.masterRule.create({
      data: {
        auditTypeId: panType.id,
        ruleName: 'PAN Format Rule',
        productNorm: 'PAN_FORMAT',
        ruleConfig: { pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$', alternatives: ['Form No-60', 'US DL'] },
        isActive: true,
      },
    }),
  ]);
  console.log(`Created ${masterRules.length} master rules`);

  // ============================================================================
  // 4. SEED USERS
  // ============================================================================
  const adminPasswordHash = await hashPassword('Admin@123');
  const auditorPasswordHash = await hashPassword('Auditor@123');

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@audit.com' },
      update: {},
      create: {
        name: 'Admin User',
        email: 'admin@audit.com',
        roleId: adminRole.id,
        passwordHash: adminPasswordHash,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { email: 'auditor1@haa.com' },
      update: {},
      create: {
        name: 'Auditor One',
        email: 'auditor1@haa.com',
        roleId: auditorRole.id,
        passwordHash: auditorPasswordHash,
        isActive: true,
      },
    }),
  ]);
  console.log(`Created ${users.length} users`);

  // ============================================================================
  // 5. SEED AUDIT RUNS (createdAt spread for dashboard period trends)
  // ============================================================================
  const daysAgo = (n) => new Date(Date.now() - n * 86400000);

  const auditRuns = await Promise.all([
    // --- Current period (last 7 days) ---
    prisma.auditRun.create({
      data: {
        auditTypeId: grossType.id,
        fileName: 'gross_weight_2024_01_15.xlsx',
        uploadedBy: users[1].id,
        status: 'COMPLETED',
        totalRows: 1250,
        invalidRows: 65,
        startedAt: daysAgo(1),
        completedAt: daysAgo(1),
        createdAt: daysAgo(1),
      },
    }),
    prisma.auditRun.create({
      data: {
        auditTypeId: panType.id,
        fileName: 'pan_customers_2024_01_14.csv',
        uploadedBy: users[1].id,
        status: 'COMPLETED',
        totalRows: 850,
        invalidRows: 30,
        startedAt: daysAgo(2),
        completedAt: daysAgo(2),
        createdAt: daysAgo(2),
      },
    }),
    prisma.auditRun.create({
      data: {
        auditTypeId: salesType.id,
        fileName: 'sales_jan_2024.xlsx',
        uploadedBy: users[1].id,
        status: 'COMPLETED',
        totalRows: 3200,
        invalidRows: 50,
        startedAt: daysAgo(3),
        completedAt: daysAgo(3),
        createdAt: daysAgo(3),
      },
    }),
    // --- Previous period (8–14 days ago) for week-over-week trends ---
    prisma.auditRun.create({
      data: {
        auditTypeId: grossType.id,
        fileName: 'gross_weight_prev_week.xlsx',
        uploadedBy: users[1].id,
        status: 'COMPLETED',
        totalRows: 2000,
        invalidRows: 80,
        startedAt: daysAgo(10),
        completedAt: daysAgo(10),
        createdAt: daysAgo(10),
      },
    }),
    prisma.auditRun.create({
      data: {
        auditTypeId: panType.id,
        fileName: 'pan_prev_week.csv',
        uploadedBy: users[1].id,
        status: 'COMPLETED',
        totalRows: 1500,
        invalidRows: 40,
        startedAt: daysAgo(12),
        completedAt: daysAgo(12),
        createdAt: daysAgo(12),
      },
    }),
  ]);
  console.log(`Created ${auditRuns.length} audit runs`);

  // ============================================================================
  // 6. SEED AUDIT ISSUE COUNTS
  // ============================================================================
  const issueCounts = await Promise.all([
    // Gross Weight Issues
    prisma.auditIssueCount.create({
      data: {
        auditRunId: auditRuns[0].id,
        issueCode: 'GROSS_MISMATCH',
        issueName: 'Gross Weight Mismatch',
        issueCount: 45,
        severity: 'ERROR',
      },
    }),
    prisma.auditIssueCount.create({
      data: {
        auditRunId: auditRuns[0].id,
        issueCode: 'NET_MISMATCH',
        issueName: 'Net Weight Mismatch',
        issueCount: 20,
        severity: 'ERROR',
      },
    }),
    // PAN Issues
    prisma.auditIssueCount.create({
      data: {
        auditRunId: auditRuns[1].id,
        issueCode: 'INVALID_PAN',
        issueName: 'Invalid PAN Format',
        issueCount: 25,
        severity: 'ERROR',
      },
    }),
    prisma.auditIssueCount.create({
      data: {
        auditRunId: auditRuns[1].id,
        issueCode: 'MISSING_PAN',
        issueName: 'Missing PAN Number',
        issueCount: 5,
        severity: 'WARNING',
      },
    }),
    // Sales Issues
    prisma.auditIssueCount.create({
      data: {
        auditRunId: auditRuns[2].id,
        issueCode: 'RATE_DEVIATION',
        issueName: 'Rate Deviation',
        issueCount: 30,
        severity: 'WARNING',
      },
    }),
    prisma.auditIssueCount.create({
      data: {
        auditRunId: auditRuns[2].id,
        issueCode: 'MISSING_UNIT_RATE',
        issueName: 'Missing Unit Rate',
        issueCount: 20,
        severity: 'ERROR',
      },
    }),
  ]);
  console.log(`Created ${issueCounts.length} audit issue counts`);

  // ============================================================================
  // 7. SEED GROSS AUDIT SUMMARIES
  // ============================================================================
  const grossSummaries = await Promise.all([
    prisma.grossAuditSummary.create({
      data: {
        auditRunId: auditRuns[0].id,
        grossMismatchCount: 25,
        netMismatchCount: 20,
        stoneMismatchCount: 20,
        validRows: 1185,
        invalidRows: 65,
      },
    }),
  ]);
  console.log(`Created ${grossSummaries.length} gross audit summaries`);

  // ============================================================================
  // 8. SEED ID PROOF AUDIT SUMMARIES
  // ============================================================================
  const idProofSummaries = await Promise.all([
    prisma.idProofAuditSummary.create({
      data: {
        auditRunId: auditRuns[1].id,
        invalidPanCount: 25,
        invalidAadharCount: 0,
        invalidGstCount: 0,
        duplicatePanCount: 5,
        duplicateAadharCount: 0,
        missingIdCount: 5,
      },
    }),
  ]);
  console.log(`Created ${idProofSummaries.length} ID proof audit summaries`);

  // ============================================================================
  // 9. SEED UPLOADED FILES
  // ============================================================================
  const uploadedFiles = await Promise.all([
    prisma.uploadedFile.create({
      data: {
        auditRunId: auditRuns[0].id,
        fileName: 'gross_weight_data.xlsx',
        originalName: 'gross_weight_data.xlsx',
        fileSize: BigInt(245760),
        fileHash: 'abc123hash456',
        storagePath: '/uploads/gross_weight_data.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploadedBy: users[1].id,
      },
    }),
    prisma.uploadedFile.create({
      data: {
        auditRunId: auditRuns[1].id,
        fileName: 'customer_pan_data.csv',
        originalName: 'customer_pan_data.csv',
        fileSize: BigInt(15360),
        fileHash: 'def456hash789',
        storagePath: '/uploads/customer_pan_data.csv',
        mimeType: 'text/csv',
        uploadedBy: users[1].id,
      },
    }),
    prisma.uploadedFile.create({
      data: {
        auditRunId: auditRuns[2].id,
        fileName: 'sales_jan_2024.xlsx',
        originalName: 'sales_jan_2024.xlsx',
        fileSize: BigInt(512000),
        fileHash: 'ghi789hash012',
        storagePath: '/uploads/sales_jan_2024.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploadedBy: users[1].id,
      },
    }),
  ]);
  console.log(`Created ${uploadedFiles.length} uploaded files`);

  // ============================================================================
  // 10. SEED AUDIT PERFORMANCE
  // ============================================================================
  const performances = await Promise.all([
    prisma.auditPerformance.create({
      data: {
        auditRunId: auditRuns[0].id,
        processingTimeMs: 45000,
        memoryUsageMb: 128.50,
        rowsProcessed: 1250,
        rowsPerSecond: 27.78,
        cpuUsagePercent: 45.20,
      },
    }),
    prisma.auditPerformance.create({
      data: {
        auditRunId: auditRuns[1].id,
        processingTimeMs: 32000,
        memoryUsageMb: 64.25,
        rowsProcessed: 850,
        rowsPerSecond: 26.56,
        cpuUsagePercent: 38.50,
      },
    }),
    prisma.auditPerformance.create({
      data: {
        auditRunId: auditRuns[2].id,
        processingTimeMs: 120000,
        memoryUsageMb: 256.00,
        rowsProcessed: 3200,
        rowsPerSecond: 26.67,
        cpuUsagePercent: 52.80,
      },
    }),
  ]);
  console.log(`Created ${performances.length} audit performance records`);

  // ============================================================================
  // 11. SEED DASHBOARD SUMMARY
  // ============================================================================
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dashboardSummaries = await Promise.all([
    prisma.dashboardSummary.create({
      data: {
        summaryDate: today,
        totalFilesUploaded: 3,
        totalAudits: 3,
        completedAudits: 3,
        failedAudits: 0,
        processingAudits: 0,
        totalRowsProcessed: 5300,
        totalInvalidRows: 145,
        totalUsers: 2,
        avgProcessingTimeSec: 65.67,
        successRate: 100.00,
      },
    }),
    prisma.dashboardSummary.create({
      data: {
        summaryDate: yesterday,
        totalFilesUploaded: 5,
        totalAudits: 5,
        completedAudits: 4,
        failedAudits: 1,
        processingAudits: 0,
        totalRowsProcessed: 8200,
        totalInvalidRows: 203,
        totalUsers: 2,
        avgProcessingTimeSec: 72.50,
        successRate: 80.00,
      },
    }),
  ]);
  console.log(`Created ${dashboardSummaries.length} dashboard summaries`);

  // ============================================================================
  // 12. SEED DASHBOARD AUDIT METRICS
  // ============================================================================
  const dashboardAuditMetrics = await Promise.all([
    // Today's metrics
    prisma.dashboardAuditMetric.create({
      data: {
        dashboardSummaryId: dashboardSummaries[0].id,
        auditTypeId: grossType.id,
        totalAudits: 1,
        totalRows: 1250,
        totalInvalidRows: 65,
        avgProcessingTime: 45.00,
      },
    }),
    prisma.dashboardAuditMetric.create({
      data: {
        dashboardSummaryId: dashboardSummaries[0].id,
        auditTypeId: panType.id,
        totalAudits: 1,
        totalRows: 850,
        totalInvalidRows: 30,
        avgProcessingTime: 32.00,
      },
    }),
    prisma.dashboardAuditMetric.create({
      data: {
        dashboardSummaryId: dashboardSummaries[0].id,
        auditTypeId: salesType.id,
        totalAudits: 1,
        totalRows: 3200,
        totalInvalidRows: 50,
        avgProcessingTime: 120.00,
      },
    }),
    // Yesterday's metrics
    prisma.dashboardAuditMetric.create({
      data: {
        dashboardSummaryId: dashboardSummaries[1].id,
        auditTypeId: grossType.id,
        totalAudits: 2,
        totalRows: 4000,
        totalInvalidRows: 120,
        avgProcessingTime: 48.50,
      },
    }),
    prisma.dashboardAuditMetric.create({
      data: {
        dashboardSummaryId: dashboardSummaries[1].id,
        auditTypeId: panType.id,
        totalAudits: 2,
        totalRows: 2100,
        totalInvalidRows: 65,
        avgProcessingTime: 35.00,
      },
    }),
    prisma.dashboardAuditMetric.create({
      data: {
        dashboardSummaryId: dashboardSummaries[1].id,
        auditTypeId: rateType.id,
        totalAudits: 1,
        totalRows: 2100,
        totalInvalidRows: 18,
        avgProcessingTime: 85.00,
      },
    }),
  ]);
  console.log(`Created ${dashboardAuditMetrics.length} dashboard audit metrics`);

  console.log('\n✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

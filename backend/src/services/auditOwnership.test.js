const test = require('node:test');
const assert = require('node:assert/strict');

const prisma = require('../lib/prisma');
const auditRunPersistence = require('./auditRunPersistence.service');
const dashboardService = require('./dashboard.service');

const createdUserIds = [];

async function createTrackedUser(prefix) {
  const user = await prisma.user.create({
    data: {
      name: `${prefix} Owner`,
      email: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      passwordHash: 'hashed-password-for-test',
      role: prefix === 'admin' ? 'ADMIN' : 'AUDITOR',
      isActive: true,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

function makeAuditPayload(seed) {
  return {
    totalRows: 42 + seed,
    summary: {
      issueCounts: [{ code: 'INVALID_RATE_DEVIATION', name: 'Rate Deviation', count: 1 + seed }],
    },
  };
}

test('unauthenticated audit creation is rejected', async () => {
  await assert.rejects(
    async () => {
      await auditRunPersistence.tryPersistAuditRun(
        { user: null },
        'SALES',
        `unauth-${Date.now()}.xlsx`,
        makeAuditPayload(0),
        { originalName: `unauth-${Date.now()}.xlsx` },
        { processingTimeMs: 100 }
      );
    },
    /Authentication required/i
  );
});

test('user A creates an audit and uploaded_by is set to User A, user B creates an audit and uploaded_by is set to User B', async () => {
  const userA = await createTrackedUser('user-a');
  const userB = await createTrackedUser('user-b');

  const auditRunAId = await auditRunPersistence.persistAuditRunFromResult({
    userId: userA.id,
    auditCode: 'SALES',
    fileName: 'user-a.xlsx',
    pythonResult: makeAuditPayload(1),
  });

  const auditRunBId = await auditRunPersistence.persistAuditRunFromResult({
    userId: userB.id,
    auditCode: 'SALES',
    fileName: 'user-b.xlsx',
    pythonResult: makeAuditPayload(2),
  });

  const auditRunA = await prisma.auditRun.findUnique({ where: { id: auditRunAId } });
  const auditRunB = await prisma.auditRun.findUnique({ where: { id: auditRunBId } });

  assert.equal(auditRunA.uploadedBy, userA.id);
  assert.equal(auditRunB.uploadedBy, userB.id);
  assert.notEqual(auditRunA.uploadedBy, userB.id);
  assert.notEqual(auditRunB.uploadedBy, userA.id);
});

test('user A cannot access user B audits, but admin can', async () => {
  const userA = await createTrackedUser('user-a-visibility');
  const userB = await createTrackedUser('user-b-visibility');
  const admin = await createTrackedUser('admin');

  const aAudit = await auditRunPersistence.persistAuditRunFromResult({
    userId: userA.id,
    auditCode: 'PAN',
    fileName: 'user-a-visibility.xlsx',
    pythonResult: makeAuditPayload(3),
  });

  const bAudit = await auditRunPersistence.persistAuditRunFromResult({
    userId: userB.id,
    auditCode: 'PAN',
    fileName: 'user-b-visibility.xlsx',
    pythonResult: makeAuditPayload(4),
  });

  const userAResults = await dashboardService.getRecentAudits({ page: 1, limit: 25 }, userA);
  const userBResults = await dashboardService.getRecentAudits({ page: 1, limit: 25 }, userB);
  const adminResults = await dashboardService.getRecentAudits({ page: 1, limit: 25 }, admin);

  const userAIds = userAResults.data.map((row) => row.auditId);
  const userBIds = userBResults.data.map((row) => row.auditId);
  const adminIds = adminResults.data.map((row) => row.auditId);

  assert.ok(userAIds.includes(aAudit));
  assert.ok(!userAIds.includes(bAudit));
  assert.ok(userBIds.includes(bAudit));
  assert.ok(!userBIds.includes(aAudit));
  assert.ok(adminIds.includes(aAudit));
  assert.ok(adminIds.includes(bAudit));
});

test.after(async () => {
  await prisma.auditRun.deleteMany({
    where: { uploadedBy: { in: createdUserIds } },
  });

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
  }
});

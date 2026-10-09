const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { pathToFileURL } = require('url');

async function loadServiceWithTempRoot() {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'held-fin-'));
  process.env.HELD_FINANCIALS_DIR = root;

  const store = new Map();
  let nextId = 1;

  function key(userId, branch, slotKey) {
    return `${userId}|${branch}|${slotKey}`;
  }

  const mockRepo = {
    computeExpiresAt: () => new Date(Date.now() + 86400000),
    async listActiveByUserBranch(userId, branch) {
      return [...store.values()].filter(
        (row) => row.userId === userId && row.branch === branch && row.expiresAt > new Date()
      );
    },
    async listAllByUserBranch(userId, branch) {
      return [...store.values()].filter((row) => row.userId === userId && row.branch === branch);
    },
    async upsertSlot(row) {
      const k = key(row.userId, row.branch, row.slotKey);
      const existing = store.get(k);
      const saved = {
        id: existing?.id || nextId++,
        ...row,
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      store.set(k, saved);
      return saved;
    },
    async deleteByUserBranch(userId, branch) {
      let count = 0;
      for (const [k, row] of store.entries()) {
        if (row.userId === userId && row.branch === branch) {
          store.delete(k);
          count += 1;
        }
      }
      return { count };
    },
    async listExpired() {
      return [...store.values()].filter((row) => row.expiresAt <= new Date());
    },
    async deleteByIds(ids) {
      let count = 0;
      for (const [k, row] of store.entries()) {
        if (ids.includes(row.id)) {
          store.delete(k);
          count += 1;
        }
      }
      return { count };
    },
  };

  const repoUrl = pathToFileURL(
    path.resolve(__dirname, '../repositories/heldFinancialFile.repository.js')
  ).href;
  const serviceUrl = pathToFileURL(path.resolve(__dirname, './heldFinancials.service.js')).href;
  const pathUtilUrl = pathToFileURL(path.resolve(__dirname, '../utils/heldFinancialPath.js')).href;
  const configUrl = pathToFileURL(path.resolve(__dirname, '../config/index.js')).href;

  // Re-require after env change by clearing cache.
  delete require.cache[require.resolve('../config')];
  delete require.cache[require.resolve('../utils/heldFinancialPath')];
  delete require.cache[require.resolve('../repositories/heldFinancialFile.repository')];
  delete require.cache[require.resolve('./heldFinancials.service')];

  require.cache[require.resolve('../repositories/heldFinancialFile.repository')] = {
    id: require.resolve('../repositories/heldFinancialFile.repository'),
    filename: require.resolve('../repositories/heldFinancialFile.repository'),
    loaded: true,
    exports: mockRepo,
  };

  const service = require('./heldFinancials.service');
  return { service, root, store, mockRepo, urls: { repoUrl, serviceUrl, pathUtilUrl, configUrl } };
}

function fakeFile(name, text = 'xlsx') {
  const buffer = Buffer.from(text);
  return {
    originalname: name,
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer,
    size: buffer.length,
  };
}

function sixFiles(prefix = '') {
  return {
    salesFile: [fakeFile(`${prefix}sales.xlsx`, `${prefix}-sales`)],
    purchasesFile: [fakeFile(`${prefix}purchases.xlsx`, `${prefix}-purchases`)],
    openingQtyFile: [fakeFile(`${prefix}qty.xlsx`, `${prefix}-qty`)],
    previousYearFile: [fakeFile(`${prefix}prev.xlsx`, `${prefix}-prev`)],
    mrFile: [fakeFile(`${prefix}mr.xlsx`, `${prefix}-mr`)],
    dcFile: [fakeFile(`${prefix}dc.xlsx`, `${prefix}-dc`)],
  };
}

test('hold, list, reload, and clear branch files for one user', async () => {
  const { service, root } = await loadServiceWithTempRoot();
  const held = await service.holdBranchFiles(11, 'basheerbagh', sixFiles('bb-'));
  assert.equal(held.ready, true);
  assert.equal(held.files.length, 6);
  assert.ok(held.uploadSessionId);

  const listed = await service.listHeldFiles(11, 'basheerbagh');
  assert.equal(listed.ready, true);
  assert.equal(listed.missingSlots.length, 0);

  const loaded = await service.loadHeldFilesAsMulter(11, 'basheerbagh');
  assert.equal(loaded.salesFile[0].buffer.toString(), 'bb--sales');
  assert.equal(loaded.dcFile[0].originalname, 'bb-dc.xlsx');

  const cleared = await service.clearBranchFiles(11, 'basheerbagh');
  assert.equal(cleared.deleted, 6);
  const after = await service.listHeldFiles(11, 'basheerbagh');
  assert.equal(after.ready, false);
  assert.equal(after.files.length, 0);

  await fs.promises.rm(root, { recursive: true, force: true });
});

test('branch isolation keeps Basheerbagh and Kokapet sets separate', async () => {
  const { service, root } = await loadServiceWithTempRoot();
  await service.holdBranchFiles(11, 'basheerbagh', sixFiles('bb-'));
  await service.holdBranchFiles(11, 'kokapet', sixFiles('kk-'));

  const bb = await service.loadHeldFilesAsMulter(11, 'basheerbagh');
  const kk = await service.loadHeldFilesAsMulter(11, 'kokapet');
  assert.equal(bb.salesFile[0].buffer.toString(), 'bb--sales');
  assert.equal(kk.salesFile[0].buffer.toString(), 'kk--sales');

  await service.clearBranchFiles(11, 'kokapet');
  const bbStill = await service.listHeldFiles(11, 'basheerbagh');
  assert.equal(bbStill.ready, true);
  await assert.rejects(() => service.loadHeldFilesAsMulter(11, 'kokapet'), /No complete held/);

  await fs.promises.rm(root, { recursive: true, force: true });
});

test('user authorization keeps another user from loading held files', async () => {
  const { service, root } = await loadServiceWithTempRoot();
  await service.holdBranchFiles(11, 'basheerbagh', sixFiles('owner-'));
  const other = await service.listHeldFiles(99, 'basheerbagh');
  assert.equal(other.ready, false);
  assert.equal(other.files.length, 0);
  await assert.rejects(() => service.loadHeldFilesAsMulter(99, 'basheerbagh'), /No complete held/);

  const owner = await service.loadHeldFilesAsMulter(11, 'basheerbagh');
  assert.equal(owner.salesFile[0].buffer.toString(), 'owner--sales');

  await fs.promises.rm(root, { recursive: true, force: true });
});

test('resolveProcessFiles prefers uploaded buffers over held files', async () => {
  const { service, root } = await loadServiceWithTempRoot();
  await service.holdBranchFiles(11, 'basheerbagh', sixFiles('held-'));
  const req = {
    user: { id: 11 },
    files: {
      salesFile: [fakeFile('live-sales.xlsx', 'live-sales')],
      purchasesFile: [fakeFile('live-purchases.xlsx', 'live-purchases')],
      openingQtyFile: [fakeFile('live-qty.xlsx', 'live-qty')],
      previousYearFile: [fakeFile('live-prev.xlsx', 'live-prev')],
      mrFile: [fakeFile('live-mr.xlsx', 'live-mr')],
      dcFile: [fakeFile('live-dc.xlsx', 'live-dc')],
    },
  };
  const resolved = await service.resolveProcessFiles(req, 'basheerbagh');
  assert.equal(resolved.salesFile[0].buffer.toString(), 'live-sales');

  const heldReq = { user: { id: 11 }, files: {} };
  const fromHeld = await service.resolveProcessFiles(heldReq, 'basheerbagh');
  assert.equal(fromHeld.salesFile[0].buffer.toString(), 'held--sales');

  await fs.promises.rm(root, { recursive: true, force: true });
});

test('incomplete hold is rejected and does not wipe an existing ready set', async () => {
  const { service, root } = await loadServiceWithTempRoot();
  await service.holdBranchFiles(11, 'basheerbagh', sixFiles('keep-'));
  await assert.rejects(
    service.holdBranchFiles(11, 'basheerbagh', {
      salesFile: [fakeFile('only-sales.xlsx')],
    }),
    (err) => err?.status === 400 && /Missing/i.test(String(err.message || ''))
  );
  const listed = await service.listHeldFiles(11, 'basheerbagh');
  assert.equal(listed.ready, true);
  assert.equal(listed.files[0].originalName.startsWith('keep-') || listed.files.some((f) => f.originalName.startsWith('keep-')), true);

  await fs.promises.rm(root, { recursive: true, force: true });
});

test('Basheerbagh hold ignores Sales Return extras and stays ready', async () => {
  const { service, root } = await loadServiceWithTempRoot();
  const files = {
    ...sixFiles('bb-'),
    salesReturnFile: [fakeFile('sales-return.xlsx', 'sr')],
    purchaseReturnFile: [fakeFile('purchase-return.xlsx', 'pr')],
  };
  const held = await service.holdBranchFiles(11, 'basheerbagh', files);
  assert.equal(held.ready, true);
  assert.equal(held.files.length, 6);
  assert.equal(
    held.files.some((row) => row.slotKey === 'salesReturn' || row.slotKey === 'purchaseReturn'),
    false
  );
  const listed = await service.listHeldFiles(11, 'basheerbagh');
  assert.equal(listed.ready, true);
  const loaded = await service.loadHeldFilesAsMulter(11, 'basheerbagh');
  assert.equal(loaded.salesFile[0].buffer.toString(), 'bb--sales');
  assert.equal(loaded.salesReturnFile, undefined);

  await fs.promises.rm(root, { recursive: true, force: true });
});

test('three-branch isolation: clear one branch leaves the others', async () => {
  const { service, root } = await loadServiceWithTempRoot();
  await service.holdBranchFiles(11, 'basheerbagh', sixFiles('bb-'));
  await service.holdBranchFiles(11, 'kokapet', sixFiles('kk-'));
  await service.holdBranchFiles(11, 'jubilee-hills', {
    ...sixFiles('jh-'),
    salesReturnFile: [fakeFile('sr.xlsx', 'sr')],
    purchaseReturnFile: [fakeFile('pr.xlsx', 'pr')],
    creditNoteFile: [fakeFile('cn.xlsx', 'cn')],
    debitNoteFile: [fakeFile('dn.xlsx', 'dn')],
  });

  await service.clearBranchFiles(11, 'basheerbagh');
  assert.equal((await service.listHeldFiles(11, 'basheerbagh')).ready, false);
  assert.equal((await service.listHeldFiles(11, 'kokapet')).ready, true);
  assert.equal((await service.listHeldFiles(11, 'jubilee-hills')).ready, true);

  await service.clearBranchFiles(11, 'kokapet');
  assert.equal((await service.listHeldFiles(11, 'jubilee-hills')).ready, true);

  await fs.promises.rm(root, { recursive: true, force: true });
});

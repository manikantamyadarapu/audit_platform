const crypto = require('crypto');
const {
  FIELD_TO_SLOT,
  SLOT_TO_FIELD,
  allowedSlotsForBranch,
  isValidBranch,
  requiredSlotsForBranch,
} = require('../constants/heldFinancials');
const heldRepo = require('../repositories/heldFinancialFile.repository');
const {
  absoluteFromRelative,
  buildHeldFilePaths,
  removeEmptyParents,
  removeHeldFileQuietly,
  writeHeldFile,
} = require('../utils/heldFinancialPath');
const logger = require('../utils/logger');

/** Serialize hold/clear per user+branch so concurrent uploads cannot interleave. */
const branchLocks = new Map();

function withBranchLock(userId, branch, work) {
  const key = `${userId}:${branch}`;
  const previous = branchLocks.get(key) || Promise.resolve();
  const run = previous.catch(() => {}).then(work);
  // Keep the queue settled so a rejected hold does not leave an unhandled rejection
  // on the lock chain, while still returning the real outcome to the caller.
  const queued = run.then(
    () => undefined,
    () => undefined
  );
  branchLocks.set(key, queued);
  queued.finally(() => {
    if (branchLocks.get(key) === queued) branchLocks.delete(key);
  });
  return run;
}

/**
 * @param {object} row
 * @returns {object}
 */
function toPublicMeta(row) {
  return {
    slotKey: row.slotKey,
    fieldName: SLOT_TO_FIELD[row.slotKey] || null,
    originalName: row.originalName,
    sizeBytes: Number(row.sizeBytes),
    contentType: row.contentType || null,
    uploadSessionId: row.uploadSessionId,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : row.expiresAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

/**
 * @param {number} userId
 * @param {string} branch
 * @returns {Promise<{ branch: string, uploadSessionId: string|null, ready: boolean, missingSlots: string[], files: object[] }>}
 */
async function listHeldFiles(userId, branch) {
  if (!isValidBranch(branch)) {
    const err = new Error(`Unsupported Financials branch "${branch}"`);
    err.status = 400;
    throw err;
  }
  const rows = await heldRepo.listActiveByUserBranch(userId, branch);
  const required = requiredSlotsForBranch(branch);
  const present = new Set(rows.map((row) => row.slotKey));
  const missingSlots = required.filter((slot) => !present.has(slot));
  const uploadSessionId = rows[0]?.uploadSessionId || null;
  return {
    branch,
    uploadSessionId,
    ready: missingSlots.length === 0,
    missingSlots,
    files: rows.map(toPublicMeta),
  };
}

/**
 * Replace the held set for one user+branch with the uploaded multer files.
 * @param {number} userId
 * @param {string} branch
 * @param {Record<string, object[]|undefined>} multerFiles
 * @returns {Promise<object>}
 */
async function holdBranchFiles(userId, branch, multerFiles) {
  return withBranchLock(userId, branch, async () => {
    if (!isValidBranch(branch)) {
      const err = new Error(`Unsupported Financials branch "${branch}"`);
      err.status = 400;
      throw err;
    }

    const allowed = new Set(allowedSlotsForBranch(branch));
    /** @type {Array<{ slotKey: string, file: object }>} */
    const incoming = [];
    for (const [field, files] of Object.entries(multerFiles || {})) {
      const slotKey = FIELD_TO_SLOT[field];
      if (!slotKey || !allowed.has(slotKey)) continue;
      const file = Array.isArray(files) ? files[0] : null;
      if (!file?.buffer?.length) continue;
      incoming.push({ slotKey, file });
    }

    if (!incoming.length) {
      const err = new Error('No Financials workbooks were uploaded to hold');
      err.status = 400;
      throw err;
    }

    const required = requiredSlotsForBranch(branch);
    const presentSlots = new Set(incoming.map((item) => item.slotKey));
    const missingRequired = required.filter((slot) => !presentSlots.has(slot));
    if (missingRequired.length) {
      const err = new Error(
        `Cannot hold incomplete ${branch} set. Missing: ${missingRequired.join(', ')}`
      );
      err.status = 400;
      throw err;
    }

    await clearBranchFilesUnlocked(userId, branch);

    const uploadSessionId = crypto.randomUUID();
    const expiresAt = heldRepo.computeExpiresAt();
    const saved = [];

    for (const { slotKey, file } of incoming) {
      const { absolutePath, relativePath } = buildHeldFilePaths(
        userId,
        branch,
        slotKey,
        file.originalname
      );
      await writeHeldFile(absolutePath, file.buffer);
      const row = await heldRepo.upsertSlot({
        userId,
        branch,
        slotKey,
        uploadSessionId,
        originalName: file.originalname || `${slotKey}.xlsx`,
        storagePath: relativePath,
        sizeBytes: BigInt(file.size || file.buffer.length),
        contentType: file.mimetype || null,
        expiresAt,
      });
      saved.push(toPublicMeta(row));
    }

    logger.info('Held Financials files saved', {
      userId,
      branch,
      uploadSessionId,
      slots: saved.map((item) => item.slotKey),
    });

    return {
      branch,
      uploadSessionId,
      ready: true,
      missingSlots: [],
      files: saved,
    };
  });
}

/**
 * @param {number} userId
 * @param {string} branch
 * @returns {Promise<{ deleted: number }>}
 */
async function clearBranchFilesUnlocked(userId, branch) {
  const existing = await heldRepo.listAllByUserBranch(userId, branch);
  for (const row of existing) {
    const absolutePath = absoluteFromRelative(row.storagePath);
    await removeHeldFileQuietly(absolutePath);
    await removeEmptyParents(absolutePath);
  }
  const result = await heldRepo.deleteByUserBranch(userId, branch);
  return { deleted: result.count };
}

async function clearBranchFiles(userId, branch) {
  if (!isValidBranch(branch)) {
    const err = new Error(`Unsupported Financials branch "${branch}"`);
    err.status = 400;
    throw err;
  }
  return withBranchLock(userId, branch, () => clearBranchFilesUnlocked(userId, branch));
}

/**
 * Load held workbooks as multer-like file objects for existing process handlers.
 * @param {number} userId
 * @param {string} branch
 * @returns {Promise<Record<string, object[]>>}
 */
async function loadHeldFilesAsMulter(userId, branch) {
  if (!isValidBranch(branch)) {
    const err = new Error(`Unsupported Financials branch "${branch}"`);
    err.status = 400;
    throw err;
  }

  const rows = await heldRepo.listActiveByUserBranch(userId, branch);
  const required = requiredSlotsForBranch(branch);
  const bySlot = new Map(rows.map((row) => [row.slotKey, row]));
  const missing = required.filter((slot) => !bySlot.has(slot));
  if (missing.length) {
    const err = new Error(
      `No complete held ${branch} folder for this user. Missing: ${missing.join(', ')}`
    );
    err.status = 404;
    throw err;
  }

  /** @type {Record<string, object[]>} */
  const files = {};
  for (const row of rows) {
    const field = SLOT_TO_FIELD[row.slotKey];
    if (!field) continue;
    const absolutePath = absoluteFromRelative(row.storagePath);
    let buffer;
    try {
      buffer = await require('fs').promises.readFile(absolutePath);
    } catch (err) {
      const missingErr = new Error(
        `Held ${branch} file for "${row.slotKey}" is missing on disk. Re-upload the folder.`
      );
      missingErr.status = 404;
      missingErr.cause = err;
      throw missingErr;
    }
    files[field] = [
      {
        fieldname: field,
        originalname: row.originalName,
        encoding: '7bit',
        mimetype:
          row.contentType ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer,
        size: buffer.length,
      },
    ];
  }
  return files;
}

/**
 * Merge request uploads with held files. Uploaded fields win.
 * @param {import('express').Request} req
 * @param {string} branch
 * @returns {Promise<Record<string, object[]>>}
 */
async function resolveProcessFiles(req, branch) {
  const uploaded = req.files && typeof req.files === 'object' ? req.files : {};
  const hasUpload = Object.values(uploaded).some(
    (list) => Array.isArray(list) && list[0]?.buffer?.length
  );
  if (hasUpload) {
    return uploaded;
  }
  const userId = req.user?.id;
  if (!userId) {
    const err = new Error('Authentication required to use held Financials files');
    err.status = 401;
    throw err;
  }
  return loadHeldFilesAsMulter(userId, branch);
}

/**
 * Delete expired held files from disk and database.
 * @returns {Promise<number>}
 */
async function cleanupExpiredHeldFiles() {
  const expired = await heldRepo.listExpired();
  if (!expired.length) return 0;
  for (const row of expired) {
    const absolutePath = absoluteFromRelative(row.storagePath);
    await removeHeldFileQuietly(absolutePath);
    await removeEmptyParents(absolutePath);
  }
  await heldRepo.deleteByIds(expired.map((row) => row.id));
  return expired.length;
}

module.exports = {
  listHeldFiles,
  holdBranchFiles,
  clearBranchFiles,
  loadHeldFilesAsMulter,
  resolveProcessFiles,
  cleanupExpiredHeldFiles,
  toPublicMeta,
};

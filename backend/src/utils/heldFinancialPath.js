const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { HELD_FINANCIALS_DIR } = require('../config');

/**
 * @param {string} originalName
 * @returns {string}
 */
function sanitizeOriginalName(originalName) {
  const base = path.basename(String(originalName || 'workbook.xlsx')).replace(/[^\w.\-()+ ]+/g, '_');
  const cleaned = base.trim() || 'workbook.xlsx';
  if (!/\.(xlsx|xlsm)$/i.test(cleaned)) {
    return `${cleaned}.xlsx`;
  }
  return cleaned.slice(0, 180);
}

/**
 * Absolute storage root for held Financials files.
 * @returns {string}
 */
function heldRootDir() {
  return path.resolve(HELD_FINANCIALS_DIR);
}

/**
 * Build a path under the held-files root. Throws if the result escapes the root.
 * @param {...string} parts
 * @returns {string}
 */
function resolveHeldPath(...parts) {
  const root = heldRootDir();
  const resolved = path.resolve(root, ...parts);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error('Held file path escapes storage root');
  }
  return resolved;
}

/**
 * @param {number|string} userId
 * @param {string} branch
 * @param {string} slotKey
 * @param {string} originalName
 * @returns {{ absolutePath: string, relativePath: string }}
 */
function buildHeldFilePaths(userId, branch, slotKey, originalName) {
  const safeName = sanitizeOriginalName(originalName);
  const fileName = `${crypto.randomUUID()}_${safeName}`;
  const relativePath = path.join(String(userId), branch, slotKey, fileName);
  const absolutePath = resolveHeldPath(relativePath);
  return { absolutePath, relativePath: relativePath.split(path.sep).join('/') };
}

/**
 * @param {string} relativePath
 * @returns {string}
 */
function absoluteFromRelative(relativePath) {
  const parts = String(relativePath || '')
    .split(/[/\\]+/)
    .filter((part) => part && part !== '.' && part !== '..');
  return resolveHeldPath(...parts);
}

/**
 * @param {string} absolutePath
 * @param {Buffer} buffer
 */
async function writeHeldFile(absolutePath, buffer) {
  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, buffer);
}

/**
 * @param {string} absolutePath
 */
async function removeHeldFileQuietly(absolutePath) {
  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

/**
 * Remove empty parent directories up to (but not including) the storage root.
 * @param {string} absolutePath
 */
async function removeEmptyParents(absolutePath) {
  const root = heldRootDir();
  let dir = path.dirname(absolutePath);
  while (dir.startsWith(root) && dir !== root) {
    try {
      await fs.promises.rmdir(dir);
    } catch {
      break;
    }
    dir = path.dirname(dir);
  }
}

module.exports = {
  sanitizeOriginalName,
  heldRootDir,
  resolveHeldPath,
  buildHeldFilePaths,
  absoluteFromRelative,
  writeHeldFile,
  removeHeldFileQuietly,
  removeEmptyParents,
};

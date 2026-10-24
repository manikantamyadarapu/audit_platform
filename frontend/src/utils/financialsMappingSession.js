/**
 * Financials manual mappings are scoped to the signed-in user, the branch,
 * and one stable audit session. The session id lives with the branch workspace
 * and changes only when the user starts a new audit — not on rerun or refresh.
 */

import { normalizeFinancialsHoldBranch } from './financialsHoldUpload.js';

const SCOPED_KEY = 'financials-scoped-mappings';
const ACTIVE_KEY = 'financials-mapping-active-session';
const MIGRATED_KEY = 'financials-mapping-legacy-migrated';
const LEGACY_OPENING_KEY = 'financials-opening-stock-mappings';
const LEGACY_RECEIPT_KEY = 'financials-receipt-rate-mappings';
const LEGACY_JUBILEE_KEY = 'jubilee_opening_amount_mappings';

function storage() {
  return globalThis.localStorage;
}

function readJson(key) {
  try {
    const parsed = JSON.parse(storage().getItem(key) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeJson(key, value) {
  storage().setItem(key, JSON.stringify(value));
}

export function mappingUserId() {
  try {
    const local = storage();
    const session = globalThis.sessionStorage;
    const localToken = local?.getItem('accessToken') || local?.getItem('token');
    const sessionToken = session?.getItem?.('accessToken') || session?.getItem?.('token');
    const primary = localToken ? local : sessionToken ? session : null;
    const raw =
      primary?.getItem?.('user') ||
      local?.getItem('user') ||
      session?.getItem?.('user') ||
      null;
    const user = raw ? JSON.parse(raw) : null;
    const id = user?.id ?? user?.userId;
    return id != null && id !== '' ? String(id) : 'anon';
  } catch {
    return 'anon';
  }
}

export function normalizeMappingBranch(branch) {
  return normalizeFinancialsHoldBranch(branch);
}

export function createMappingSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `fin-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function readActiveMappingSessionId(branch) {
  const id = readJson(ACTIVE_KEY)?.[mappingUserId()]?.[normalizeMappingBranch(branch)];
  return typeof id === 'string' && id ? id : null;
}

export function setActiveMappingSessionId(branch, sessionId) {
  const user = mappingUserId();
  const key = normalizeMappingBranch(branch);
  const all = readJson(ACTIVE_KEY);
  all[user] = { ...(all[user] && typeof all[user] === 'object' ? all[user] : {}), [key]: sessionId };
  writeJson(ACTIVE_KEY, all);
  return sessionId;
}

function emptyBucket() {
  return { opening: [], receipt: [] };
}

function readBucket(branch, sessionId) {
  const all = readJson(SCOPED_KEY);
  const bucket = all?.[mappingUserId()]?.[normalizeMappingBranch(branch)]?.[sessionId];
  if (!bucket || typeof bucket !== 'object') return emptyBucket();
  return {
    opening: Array.isArray(bucket.opening) ? bucket.opening : [],
    receipt: Array.isArray(bucket.receipt) ? bucket.receipt : [],
  };
}

function writeBucket(branch, sessionId, bucket) {
  const user = mappingUserId();
  const key = normalizeMappingBranch(branch);
  const all = readJson(SCOPED_KEY);
  const byUser = all[user] && typeof all[user] === 'object' ? all[user] : {};
  const byBranch = byUser[key] && typeof byUser[key] === 'object' ? byUser[key] : {};
  byBranch[sessionId] = bucket;
  byUser[key] = byBranch;
  all[user] = byUser;
  writeJson(SCOPED_KEY, all);
}

function legacyList(store, branch) {
  const key = normalizeMappingBranch(branch);
  if (Array.isArray(store?.[key])) return store[key];
  if (key === 'jubilee-hills' && Array.isArray(store?.jubileeHills)) return store.jubileeHills;
  return [];
}

function migrateLegacyIntoSession(branch, sessionId) {
  const user = mappingUserId();
  const key = normalizeMappingBranch(branch);
  const flags = readJson(MIGRATED_KEY);
  if (flags?.[user]?.[key]) return;
  const opening = [
    ...legacyList(readJson(LEGACY_OPENING_KEY), branch),
    ...(key === 'jubilee-hills' && Array.isArray(readJson(LEGACY_JUBILEE_KEY))
      ? readJson(LEGACY_JUBILEE_KEY)
      : []),
  ];
  const receipt = legacyList(readJson(LEGACY_RECEIPT_KEY), branch);
  if (opening.length || receipt.length) {
    const current = readBucket(branch, sessionId);
    writeBucket(branch, sessionId, {
      opening: current.opening.length ? current.opening : opening,
      receipt: current.receipt.length ? current.receipt : receipt,
    });
  }
  const nextFlags = { ...flags, [user]: { ...(flags[user] || {}), [key]: sessionId } };
  writeJson(MIGRATED_KEY, nextFlags);
}

/**
 * Use the workspace's saved session id, or the active id, or create one.
 * Legacy branch-wide mappings are copied only when continuing a workspace that
 * already has results and does not yet have a session id.
 */
export function ensureFinancialsMappingSession(branch, { preferredId = null, adoptLegacy = false } = {}) {
  const id = preferredId || readActiveMappingSessionId(branch) || createMappingSessionId();
  setActiveMappingSessionId(branch, id);
  if (adoptLegacy) migrateLegacyIntoSession(branch, id);
  return id;
}

/** Start a new audit scope. Previous sessions stay stored and are not reused. */
export function beginFinancialsMappingSession(branch) {
  const id = createMappingSessionId();
  setActiveMappingSessionId(branch, id);
  writeBucket(branch, id, emptyBucket());
  return id;
}

export const SIX_FILE_NAME_KEYS = Object.freeze([
  'sales',
  'purchases',
  'quantity',
  'previousYear',
  'mr',
  'dc',
]);

export const JUBILEE_FILE_NAME_KEYS = Object.freeze([
  ...SIX_FILE_NAME_KEYS,
  'salesReturn',
  'purchaseReturn',
  'creditNote',
  'debitNote',
]);

/** Same workbook names mean the same audit. A different file set is a new audit. */
export function isSameFinancialsFileSet(next, previous, keys = SIX_FILE_NAME_KEYS) {
  return keys.every((key) => String(next?.[key] || '') === String(previous?.[key] || ''));
}

/**
 * Held-file reruns and the same file set keep the current session.
 * A different upload starts an empty mapping scope before pending lists are built.
 */
export function scopeFinancialsMappingsForProcess(branch, { rerun = false } = {}) {
  if (rerun) return ensureFinancialsMappingSession(branch);
  return beginFinancialsMappingSession(branch);
}

function activeId(branch) {
  return readActiveMappingSessionId(branch);
}

export function readSessionOpeningMappings(branch) {
  const id = activeId(branch);
  if (!id) return [];
  return readBucket(branch, id).opening;
}

export function writeSessionOpeningMappings(branch, rows) {
  const id = activeId(branch) || beginFinancialsMappingSession(branch);
  const bucket = readBucket(branch, id);
  writeBucket(branch, id, { ...bucket, opening: rows });
  return rows;
}

export function readSessionReceiptMappings(branch) {
  const id = activeId(branch);
  if (!id) return [];
  return readBucket(branch, id).receipt;
}

export function writeSessionReceiptMappings(branch, rows) {
  const id = activeId(branch) || beginFinancialsMappingSession(branch);
  const bucket = readBucket(branch, id);
  writeBucket(branch, id, { ...bucket, receipt: rows });
  return rows;
}

/** How long audit page results/filters are kept when switching tabs (days). */
export const AUDIT_SESSION_RETENTION_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const KEY_PREFIX = 'audit-session:';

function storageKey(key) {
  return `${KEY_PREFIX}${key}`;
}

const SALES_RECORD_STORAGE_OMIT = new Set([
  'rawExcelRowJson',
  'rawJson',
  'metadata',
]);

function slimSalesRecord(record) {
  if (!record || typeof record !== 'object') return record;
  const slim = { ...record };
  for (const key of SALES_RECORD_STORAGE_OMIT) {
    delete slim[key];
  }
  return slim;
}

/** Shrink sales audit payloads so large ledgers fit in localStorage. */
export function slimSalesLedgerSnapshot(snapshot) {
  if (!snapshot?.result?.records?.length) return snapshot;
  return {
    ...snapshot,
    result: {
      ...snapshot.result,
      records: snapshot.result.records.map(slimSalesRecord),
    },
  };
}

/**
 * @param {string} key
 * @param {unknown} data
 * @param {{ transform?: (data: unknown) => unknown }} [options]
 * @returns {boolean}
 */
export function saveAuditSession(key, data, options = {}) {
  const transformed = options.transform ? options.transform(data) : data;
  const payload = {
    savedAt: Date.now(),
    expiresAt: Date.now() + AUDIT_SESSION_RETENTION_DAYS * MS_PER_DAY,
    data: transformed,
  };

  const tryWrite = (body) => {
    localStorage.setItem(storageKey(key), JSON.stringify(body));
    return true;
  };

  try {
    return tryWrite(payload);
  } catch {
    try {
      const slimmed = slimSalesLedgerSnapshot(transformed);
      return tryWrite({ ...payload, data: slimmed });
    } catch {
      return false;
    }
  }
}

/**
 * @param {string} key
 * @returns {{ savedAt: number, expiresAt: number, data: unknown } | null}
 */
export function loadAuditSession(key) {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload?.expiresAt || Date.now() > payload.expiresAt) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function clearAuditSession(key) {
  localStorage.removeItem(storageKey(key));
}

/** Whole days remaining before this session expires. */
export function daysUntilExpiry(expiresAt) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((expiresAt - Date.now()) / MS_PER_DAY));
}

export function formatSavedSessionLabel(savedAt, expiresAt) {
  if (!savedAt) return '';
  const saved = new Date(savedAt);
  const savedText = saved.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const daysLeft = daysUntilExpiry(expiresAt);
  if (daysLeft <= 0) return `Saved ${savedText}`;
  return `Saved ${savedText} · kept for ${daysLeft} more day${daysLeft === 1 ? '' : 's'}`;
}

/**
 * Read persisted page state synchronously (use in useState initializers).
 * @template T
 * @param {string} key
 * @returns {T | null}
 */
export function readAuditSessionData(key) {
  return loadAuditSession(key)?.data ?? null;
}

export function readAuditSessionMeta(key) {
  const session = loadAuditSession(key);
  if (!session) return null;
  return { savedAt: session.savedAt, expiresAt: session.expiresAt };
}

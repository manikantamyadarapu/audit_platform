import { getAuditSessionConfig } from '../config/auditSessionConfig';
import { getStoredUser } from './authUser';

/** How long audit page results/filters are kept when switching tabs (days). */
export const AUDIT_SESSION_RETENTION_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LEGACY_KEY_PREFIX = 'audit-session:';

const SALES_RECORD_STORAGE_OMIT = new Set(['rawExcelRowJson', 'rawJson', 'metadata']);

const FAT_RECORD_KEYS = new Set([
  'uploadedUnitRate',
  'uploadedRate',
  'masterStandardRate',
  'standardRate',
  'currentMarketRate',
  'minAllowedRate',
  'maxAllowedRate',
  'deviationPercent',
  'rateDifference',
  'rateValidationSource',
  'validationStatus',
  'parsedQuantity',
  'validationSalesAccount',
  'validationProduct',
  'voucherNorm',
  'auditStatus',
  'auditReason',
  'rateMessage',
  'messages',
  'rawUnitRate',
  'originalExcelSalesAccount',
  'originalExcelProduct',
  'originalExcelUnitRate',
]);

function slimSalesRecord(record) {
  if (!record || typeof record !== 'object') return record;

  if ('Message' in record) {
    const slim = { ...record };
    for (const key of SALES_RECORD_STORAGE_OMIT) {
      delete slim[key];
    }
    return slim;
  }

  const slim = {};
  for (const [key, value] of Object.entries(record)) {
    if (SALES_RECORD_STORAGE_OMIT.has(key)) continue;
    if (key.startsWith('__')) continue;
    if (FAT_RECORD_KEYS.has(key)) continue;
    slim[key] = value;
  }
  return slim;
}

function slimAuditResult(result) {
  if (!result || typeof result !== 'object') return result;

  const sourceRows = result.exceptionRecords?.length
    ? result.exceptionRecords
    : result.records;
  const rows = Array.isArray(sourceRows) ? sourceRows.map(slimSalesRecord) : [];

  return {
    success: result.success,
    fileType: result.fileType,
    totalRows: result.totalRows,
    errorRows: result.errorRows,
    summary: result.summary,
    exportColumns: result.exportColumns,
    columnDisplayHeaders: result.columnDisplayHeaders,
    sourceColumns: result.sourceColumns,
    auditRunId: result.auditRunId,
    salesAuditFileName: result.salesAuditFileName,
    salesAuditBaselineCount: result.salesAuditBaselineCount,
    salesAuditRunId: result.salesAuditRunId,
    productAverageComparisonRecords: result.productAverageComparisonRecords,
    rateComparisonRecords: result.rateComparisonRecords,
    exceptionRecords: rows,
    records: rows,
  };
}

/** Shrink sales / sales-return audit payloads for localStorage and DB session saves. */
export function slimSalesLedgerSnapshot(snapshot) {
  if (!snapshot?.result) return snapshot;
  return {
    ...snapshot,
    result: slimAuditResult(snapshot.result),
  };
}

/**
 * Resolve user-scoped localStorage key for an audit workspace.
 * Format: audit_session_{userId}_{suffix}  e.g. audit_session_1_sales_return
 *
 * @param {string} registryKey - key from AUDIT_SESSION_REGISTRY
 * @returns {string}
 */
export function resolveScopedStorageKey(registryKey) {
  const config = getAuditSessionConfig(registryKey);
  const suffix =
    config?.localStorageAlias?.replace(/^audit_session_/, '') ??
    registryKey.replace(/-/g, '_');

  const userId = getStoredUser()?.id;
  const userPart = userId != null ? String(userId) : 'anon';
  return `audit_session_${userPart}_${suffix}`;
}

function legacyStorageKey(registryKey) {
  return `${LEGACY_KEY_PREFIX}${registryKey}`;
}

function readRaw(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload?.expiresAt || Date.now() > payload.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function writeRaw(key, payload) {
  localStorage.setItem(key, JSON.stringify(payload));
}

/**
 * Load session for one audit type only (with legacy key migration).
 * @param {string} registryKey
 */
function loadScopedSession(registryKey) {
  const scopedKey = resolveScopedStorageKey(registryKey);
  let payload = readRaw(scopedKey);

  if (!payload) {
    const legacy = readRaw(legacyStorageKey(registryKey));
    if (legacy) {
      try {
        writeRaw(scopedKey, legacy);
        localStorage.removeItem(legacyStorageKey(registryKey));
      } catch {
        /* keep legacy if migration fails */
      }
      payload = legacy;
    }
  }

  return payload;
}

/**
 * @param {string} registryKey
 * @param {unknown} data
 * @param {{ transform?: (data: unknown) => unknown }} [options]
 * @returns {boolean}
 */
export function saveAuditSession(registryKey, data, options = {}) {
  const transformed = options.transform ? options.transform(data) : data;
  const payload = {
    savedAt: Date.now(),
    expiresAt: Date.now() + AUDIT_SESSION_RETENTION_DAYS * MS_PER_DAY,
    auditKey: registryKey,
    data: transformed,
  };

  const scopedKey = resolveScopedStorageKey(registryKey);

  const tryWrite = (body) => {
    writeRaw(scopedKey, body);
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
 * @param {string} registryKey
 * @returns {{ savedAt: number, expiresAt: number, auditKey?: string, data: unknown } | null}
 */
export function loadAuditSession(registryKey) {
  return loadScopedSession(registryKey);
}

export function clearAuditSession(registryKey) {
  const scopedKey = resolveScopedStorageKey(registryKey);
  localStorage.removeItem(scopedKey);
  localStorage.removeItem(legacyStorageKey(registryKey));
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
 * @param {string} registryKey
 * @returns {T | null}
 */
export function readAuditSessionData(registryKey) {
  return loadAuditSession(registryKey)?.data ?? null;
}

export function readAuditSessionMeta(registryKey) {
  const session = loadAuditSession(registryKey);
  if (!session) return null;
  return { savedAt: session.savedAt, expiresAt: session.expiresAt };
}

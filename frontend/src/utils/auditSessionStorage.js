import { getAuditSessionConfig } from '../config/auditSessionConfig';
import { getStoredUser } from './authUser';
import { panMessageForRecord } from './panRecordFilters';

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
    if (Array.isArray(record.issues) && record.issues.length) {
      slim.issues = record.issues;
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

function slimExceptionRowForStorage(record, exportColumns, columnDisplayHeaders) {
  if (!record || typeof record !== 'object') return record;

  const columns = Array.isArray(exportColumns) ? exportColumns : [];
  const headers =
    columnDisplayHeaders && typeof columnDisplayHeaders === 'object'
      ? columnDisplayHeaders
      : {};

  if (!columns.length && !('Message' in record)) {
    return slimSalesRecord(record);
  }

  const slim = {};
  for (const col of columns) {
    if (col === 'Message') continue;
    const display = headers[col] || col;
    if (display in record && record[display] != null && record[display] !== '') {
      slim[display] = record[display];
      continue;
    }
    if (col in record && record[col] != null && record[col] !== '') {
      slim[display] = record[col];
    }
  }

  // Fallback when export metadata does not match row keys — keep all upload columns.
  if (Object.keys(slim).length === 0) {
    for (const [key, value] of Object.entries(record)) {
      if (key.startsWith('_') || key === 'issues') continue;
      if (value != null && value !== '') slim[key] = value;
    }
  }

  if ('Message' in record) {
    slim.Message = record.Message;
  }

  if (Array.isArray(record.issues) && record.issues.length) {
    slim.issues = record.issues;
  }

  if (Object.keys(slim).length === 0) {
    return slimSalesRecord(record);
  }

  return slim;
}

function trimHeavySummaryFields(summary) {
  if (!summary || typeof summary !== 'object') return summary ?? {};
  const trimmed = { ...summary };
  delete trimmed.reconciliation;
  delete trimmed.auditTraceSummary;
  delete trimmed.productAverageVerification;
  return trimmed;
}

function slimAuditResult(result, { aggressive = false } = {}) {
  if (!result || typeof result !== 'object') return result;

  const exportColumns = result.exportColumns ?? [];
  const columnDisplayHeaders = result.columnDisplayHeaders ?? {};
  const sourceRows = result.exceptionRecords?.length
    ? result.exceptionRecords
    : result.records;
  const rows = Array.isArray(sourceRows)
    ? sourceRows.map((row) =>
        slimExceptionRowForStorage(row, exportColumns, columnDisplayHeaders)
      )
    : [];

  const summary = trimHeavySummaryFields(result.summary);
  summary.productAverageCount =
    result.summary?.productAverageCount ??
    (Array.isArray(result.productAverages) ? result.productAverages.length : 0);

  const slimmed = {
    success: result.success,
    fileType: result.fileType,
    totalRows: result.totalRows,
    errorRows: result.errorRows,
    summary,
    exportColumns,
    columnDisplayHeaders,
    sourceColumns: result.sourceColumns,
    auditRunId: result.auditRunId,
    salesAuditFileName: result.salesAuditFileName,
    salesAuditBaselineCount: result.salesAuditBaselineCount,
    salesAuditRunId: result.salesAuditRunId,
    exceptionRecords: rows,
    records: rows,
  };

  if (Array.isArray(result.productAverageComparisonRecords)) {
    slimmed.productAverageComparisonRecords = result.productAverageComparisonRecords;
  }
  if (Array.isArray(result.rateComparisonRecords)) {
    slimmed.rateComparisonRecords = result.rateComparisonRecords;
  }

  if (aggressive) {
    delete slimmed.productAverageComparisonRecords;
    delete slimmed.rateComparisonRecords;
  }

  return slimmed;
}

/** Extra pass when localStorage quota is exceeded. */
export function aggressiveSlimAuditSnapshot(snapshot) {
  if (!snapshot?.result) return snapshot;
  return {
    ...snapshot,
    result: slimAuditResult(snapshot.result, { aggressive: true }),
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

const PAN_RECORD_KEEP_KEYS = new Set([
  'rowNumber',
  'voucherNo',
  'nameOfTheParty',
  'salesAccount',
  'product',
  'totalValue',
  'grossAmount',
  'pan',
  'pan1',
  'addProof',
  'addProof2',
  'address',
  'uom',
  'quantity',
  'unitRate',
  'date',
  'Message',
  'issues',
  'panReport',
  'addressReport',
]);

function slimPanRecord(record, { aggressive = false } = {}) {
  if (!record || typeof record !== 'object') return record;

  const slim = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === 'messages') continue;
    if (value == null || value === '') continue;
    if (aggressive && !PAN_RECORD_KEEP_KEYS.has(key) && !key.startsWith('_')) continue;
    slim[key] = value;
  }

  if (Array.isArray(record.messages) && record.messages.length && !slim.Message) {
    slim.Message = record.messages.join('; ');
  }
  const computedMessage = panMessageForRecord(record);
  if (computedMessage) {
    slim.Message = computedMessage;
  }

  return slim;
}

function slimPanResult(result, { aggressive = false } = {}) {
  if (!result || typeof result !== 'object') return result;
  const records = Array.isArray(result.records)
    ? result.records.map((row) => slimPanRecord(row, { aggressive }))
    : [];

  return {
    success: result.success,
    fileType: result.fileType,
    totalRows: result.totalRows,
    errorRows: result.errorRows,
    summary: result.summary ?? {},
    auditRunId: result.auditRunId ?? null,
    records,
  };
}

/** Shrink PAN / ID proof audit payloads for localStorage and DB session saves. */
export function slimPanSnapshot(snapshot) {
  if (!snapshot?.result) return snapshot;
  return {
    ...snapshot,
    result: slimPanResult(snapshot.result),
  };
}

/** Extra pass when PAN session exceeds localStorage quota. */
export function aggressiveSlimPanSnapshot(snapshot) {
  if (!snapshot?.result) return snapshot;
  return {
    ...snapshot,
    result: slimPanResult(snapshot.result, { aggressive: true }),
  };
}

/** Extra pass when gross-weight session exceeds localStorage quota. */
export function aggressiveSlimGrossWeightSnapshot(snapshot) {
  return slimGrossWeightSnapshot(snapshot);
}

export function aggressiveSlimSnapshotForRegistry(registryKey, snapshot) {
  switch (registryKey) {
    case 'pan-audit':
      return aggressiveSlimPanSnapshot(snapshot);
    case 'gross-weight':
      return aggressiveSlimGrossWeightSnapshot(snapshot);
    case 'cash-ledger':
      return slimCashLedgerSnapshot(snapshot);
    default:
      return aggressiveSlimAuditSnapshot(snapshot);
  }
}

/** Shrink gross-weight audit payloads for localStorage and DB session saves. */
export function slimGrossWeightSnapshot(snapshot) {
  if (!snapshot?.result) return snapshot;
  const result = snapshot.result;
  const records = Array.isArray(result.records)
    ? result.records.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const { messages, ...rest } = row;
        return rest;
      })
    : [];
  return {
    ...snapshot,
    result: {
      success: result.success,
      totalRows: result.totalRows,
      errorRows: result.errorRows,
      summary: result.summary ?? {},
      records,
    },
  };
}

/** Shrink cash ledger audit payloads for localStorage and DB session saves. */
export function slimCashLedgerSnapshot(snapshot) {
  if (!snapshot?.result) return snapshot;
  const result = snapshot.result;
  const records = Array.isArray(result.records)
    ? result.records.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const { messages, ...rest } = row;
        return rest;
      })
    : [];
  return {
    ...snapshot,
    activeFilter: snapshot.activeFilter ?? null,
    result: {
      success: result.success,
      fileType: result.fileType,
      totalRows: result.totalRows,
      errorRows: result.errorRows,
      summary: result.summary ?? {},
      exportColumns: result.exportColumns,
      columnDisplayHeaders: result.columnDisplayHeaders,
      records,
    },
  };
}

/** In-memory cache — avoids re-parsing localStorage on every audit page mount. */
const sessionMemoryCache = new Map();

function memoryCacheKey(registryKey) {
  return resolveScopedStorageKey(registryKey);
}

function readCachedSession(registryKey) {
  const key = memoryCacheKey(registryKey);
  if (sessionMemoryCache.has(key)) {
    return sessionMemoryCache.get(key);
  }
  const payload = loadScopedSessionFromDisk(registryKey);
  if (payload) {
    sessionMemoryCache.set(key, payload);
  }
  return payload ?? null;
}

function writeCachedSession(registryKey, payload) {
  sessionMemoryCache.set(memoryCacheKey(registryKey), payload);
}

function dropCachedSession(registryKey) {
  sessionMemoryCache.delete(memoryCacheKey(registryKey));
}

/**
 * Single read for page bootstrap — data + meta together (one localStorage parse).
 * @param {string} registryKey
 */
export function bootstrapAuditSessionState(registryKey) {
  const session = readCachedSession(registryKey);
  return {
    data: session?.data ?? null,
    meta: session ? { savedAt: session.savedAt, expiresAt: session.expiresAt } : null,
  };
}

/**
 * Resolve user-scoped localStorage key for an audit workspace.
 * Format: audit_session_USERID_suffix (e.g. audit_session_1_sales_return)
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
function loadScopedSessionFromDisk(registryKey) {
  const config = getAuditSessionConfig(registryKey);
  const suffix =
    config?.localStorageAlias?.replace(/^audit_session_/, '') ??
    registryKey.replace(/-/g, '_');
  const scopedKey = resolveScopedStorageKey(registryKey);
  const keysToTry = [scopedKey];

  const userId = getStoredUser()?.id;
  if (userId != null) {
    keysToTry.push(`audit_session_anon_${suffix}`);
  }
  keysToTry.push(legacyStorageKey(registryKey));

  for (const key of keysToTry) {
    const payload = readRaw(key);
    if (!payload?.data) continue;
    if (!payload.data.result && !payload.data.sheetError) continue;

    if (key !== scopedKey) {
      try {
        writeRaw(scopedKey, payload);
        if (key.startsWith('audit_session_') && key !== scopedKey) {
          localStorage.removeItem(key);
        }
        if (key === legacyStorageKey(registryKey)) {
          localStorage.removeItem(key);
        }
      } catch {
        /* keep readable copy under legacy key */
      }
    }
    return payload;
  }

  return null;
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
    const ok = tryWrite(payload);
    if (ok) writeCachedSession(registryKey, payload);
    return ok;
  } catch {
    try {
      const aggressive = aggressiveSlimSnapshotForRegistry(registryKey, transformed);
      const body = { ...payload, data: aggressive };
      const ok = tryWrite(body);
      if (ok) writeCachedSession(registryKey, body);
      return ok;
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
  return readCachedSession(registryKey);
}

export function clearAuditSession(registryKey) {
  const scopedKey = resolveScopedStorageKey(registryKey);
  dropCachedSession(registryKey);
  localStorage.removeItem(scopedKey);
  localStorage.removeItem(legacyStorageKey(registryKey));
  const config = getAuditSessionConfig(registryKey);
  const suffix =
    config?.localStorageAlias?.replace(/^audit_session_/, '') ??
    registryKey.replace(/-/g, '_');
  localStorage.removeItem(`audit_session_anon_${suffix}`);
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
  return bootstrapAuditSessionState(registryKey).data;
}

export function readAuditSessionMeta(registryKey) {
  return bootstrapAuditSessionState(registryKey).meta;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAuditSession,
  formatSavedSessionLabel,
  loadAuditSession,
  loadAuditSessionOverflow,
  readAuditSessionMeta,
  saveAuditSession,
  saveAuditSessionOverflow,
  aggressiveSlimSnapshotForRegistry,
} from '../utils/auditSessionStorage';
import { isFinancialsSessionKey } from '../utils/financialsSessionKeys';

function financialsSessionUsable(payload, registryKey) {
  const data = payload?.data;
  if (!data) return false;
  if (data.sheetError) return true;
  if (registryKey === 'financials-jubilee-hills') {
    return Boolean(data.result?.layoutByCategory);
  }
  return Boolean(data.result);
}

function openingPendingCount(payload) {
  const result = payload?.data?.result;
  const report = result?.openingStockReport || result?.summary?.openingStockReport;
  const jubilee = result?.openingAmountMatch?.manualMappingRequiredRows;
  if (Array.isArray(report?.manualMappingRequired) && report.manualMappingRequired.length) {
    return report.manualMappingRequired.length;
  }
  if (Array.isArray(jubilee) && jubilee.length) return jubilee.length;
  return 0;
}

function hasOpeningReport(payload) {
  const result = payload?.data?.result;
  return Boolean(
    result?.openingStockReport ||
      result?.summary?.openingStockReport ||
      result?.openingAmountMatch
  );
}

function preferFinancialsPayload(local, overflow) {
  if (!overflow?.data) return local;
  if (!local?.data) return overflow;
  const localHas = hasOpeningReport(local);
  const overflowHas = hasOpeningReport(overflow);
  if (overflowHas && !localHas) return overflow;
  if (localHas && !overflowHas) return local;
  return (overflow.savedAt || 0) >= (local.savedAt || 0) ? overflow : local;
}

function metaEquals(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.savedAt === b.savedAt && a.expiresAt === b.expiresAt;
}

/**
 * Persist audit page state in the browser only (localStorage, 7-day TTL).
 * Latest completed validation always wins — no server/DB sync.
 *
 * @template T
 * @param {string} registryKey
 * @param {T} snapshot
 * @param {{
 *   transform?: (data: T) => T,
 *   onSaveFailed?: () => void,
 *   onApplySession?: (data: T) => void,
 * }} [options]
 */
export function useAuditSessionPersistence(registryKey, snapshot, options = {}) {
  const [sessionMeta, setSessionMeta] = useState(() => readAuditSessionMeta(registryKey));
  const [restoring, setRestoring] = useState(false);

  const snapshotRef = useRef(snapshot);
  const mountGenerationRef = useRef(0);
  const lastPersistKeyRef = useRef('');
  const optionsRef = useRef(options);
  optionsRef.current = options;

  snapshotRef.current = snapshot;

  const updateSessionMeta = useCallback((next) => {
    setSessionMeta((prev) => (metaEquals(prev, next) ? prev : next));
  }, []);

  const applySessionPayload = useCallback((payload) => {
    if (payload && optionsRef.current.onApplySession) {
      optionsRef.current.onApplySession(payload);
    }
  }, []);

  const persist = useCallback(
    (data = snapshotRef.current, persistOptions = {}) => {
      const notifyOnFailure = persistOptions.notifyOnFailure === true;
      const force = persistOptions.force === true;

      if (!data?.result && !data?.sheetError) {
        return false;
      }

      const transform = optionsRef.current.transform;
      const payloadToStore = transform ? transform(data) : data;
      const resultSig = data.result
        ? `${data.result.auditRunId ?? ''}:${data.result.totalRows ?? ''}:${data.result.errorRows ?? ''}:${openingPendingCount({ data })}`
        : '';
      const persistKey = `${registryKey}:${data.fileName ?? ''}:${Boolean(data.result)}:${Boolean(data.sheetError)}:${data.activeFilter ?? ''}:${data.mappingSessionId ?? ''}:${resultSig}`;

      if (!force && persistKey === lastPersistKeyRef.current) return true;
      lastPersistKeyRef.current = persistKey;

      const payloadForStorage = force
        ? { ...payloadToStore, validatedAt: Date.now() }
        : payloadToStore;

      let storedPayload = payloadForStorage;
      let ok = saveAuditSession(registryKey, storedPayload);
      if (!ok && payloadToStore?.result) {
        storedPayload = aggressiveSlimSnapshotForRegistry(registryKey, payloadForStorage);
        ok = saveAuditSession(registryKey, storedPayload);
      }

      if (isFinancialsSessionKey(registryKey) && (storedPayload?.result || payloadForStorage?.result)) {
        const overflowBody = ok ? storedPayload : payloadForStorage;
        void saveAuditSessionOverflow(registryKey, overflowBody)
          .then((saved) => {
            if (saved) {
              updateSessionMeta(readAuditSessionMeta(registryKey));
              return;
            }
            if (!ok && notifyOnFailure && optionsRef.current.onSaveFailed) {
              optionsRef.current.onSaveFailed();
            }
          })
          .catch(() => {
            if (!ok && notifyOnFailure && optionsRef.current.onSaveFailed) {
              optionsRef.current.onSaveFailed();
            }
          });
        if (!ok) return true;
      }

      if (ok) {
        updateSessionMeta(readAuditSessionMeta(registryKey));
      } else if (notifyOnFailure && optionsRef.current.onSaveFailed) {
        optionsRef.current.onSaveFailed();
      }

      return ok;
    },
    [registryKey, updateSessionMeta]
  );

  // Hydrate from browser storage once on mount.
  useEffect(() => {
    const generation = ++mountGenerationRef.current;
    lastPersistKeyRef.current = '';
    let cancelled = false;

    async function hydrate() {
      let local = loadAuditSession(registryKey);
      if (isFinancialsSessionKey(registryKey)) {
        try {
          const overflow = await loadAuditSessionOverflow(registryKey);
          if (!cancelled && financialsSessionUsable(overflow, registryKey)) {
            local = preferFinancialsPayload(local, overflow);
          }
        } catch {
          /* keep the localStorage copy */
        }
      }
      if (cancelled || generation !== mountGenerationRef.current) return;

      if (local?.data) {
        const snap = snapshotRef.current;
        const alreadyHasWorkspace = Boolean(snap?.result || snap?.sheetError);
        const localHasWorkspace = Boolean(local.data?.result || local.data?.sheetError);
        const alreadyHasSheet = Boolean(snap?.result?.layoutByCategory);
        const localHasSheet = Boolean(local.data?.result?.layoutByCategory);
        const pendingDiffers = openingPendingCount({ data: snap }) !== openingPendingCount(local);
        const shouldApply =
          registryKey === 'financials-jubilee-hills'
            ? (localHasSheet && !alreadyHasSheet) || pendingDiffers
            : (localHasWorkspace && !alreadyHasWorkspace) || pendingDiffers;
        if (shouldApply) {
          applySessionPayload(local.data);
        }
        updateSessionMeta({ savedAt: local.savedAt, expiresAt: local.expiresAt });
        return;
      }

      if (generation === mountGenerationRef.current) {
        updateSessionMeta(null);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [registryKey, applySessionPayload, updateSessionMeta]);

  // Auto-save filter/workspace changes — persist() dedupes identical writes.
  useEffect(() => {
    if (!snapshot?.result && !snapshot?.sheetError) return;
    persist(snapshot);
  }, [registryKey, snapshot, persist]);

  // Flush latest snapshot when leaving the page.
  useEffect(() => {
    return () => {
      const snap = snapshotRef.current;
      queueMicrotask(() => {
        if (snap?.result || snap?.sheetError) {
          persist(snap);
        }
      });
    };
  }, [registryKey, persist]);

  const restoreSession = useCallback(async () => {
    setRestoring(true);
    try {
      lastPersistKeyRef.current = '';
      let local = loadAuditSession(registryKey);
      if (isFinancialsSessionKey(registryKey)) {
        try {
          const overflow = await loadAuditSessionOverflow(registryKey);
          if (financialsSessionUsable(overflow, registryKey)) {
            local = preferFinancialsPayload(local, overflow);
          }
        } catch {
          /* keep localStorage */
        }
      }
      if (local?.data) {
        applySessionPayload(local.data);
        updateSessionMeta({ savedAt: local.savedAt, expiresAt: local.expiresAt });
      }
    } finally {
      setRestoring(false);
    }
  }, [registryKey, applySessionPayload, updateSessionMeta]);

  const startNewAudit = useCallback(async () => {
    setRestoring(true);
    try {
      lastPersistKeyRef.current = '';
      clearAuditSession(registryKey);
      updateSessionMeta(null);
      applySessionPayload({
        result: null,
        sheetError: null,
        activeFilter: null,
        fileName: null,
      });
    } finally {
      setRestoring(false);
    }
  }, [registryKey, applySessionPayload, updateSessionMeta]);

  const sessionLabel = sessionMeta
    ? formatSavedSessionLabel(sessionMeta.savedAt, sessionMeta.expiresAt)
    : '';

  return {
    sessionLabel,
    sessionMeta,
    persist,
    restoreSession,
    startNewAudit,
    restoring,
  };
}

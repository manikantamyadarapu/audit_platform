import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAuditSession,
  formatSavedSessionLabel,
  loadAuditSession,
  readAuditSessionMeta,
  saveAuditSession,
  aggressiveSlimSnapshotForRegistry,
} from '../utils/auditSessionStorage';

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

      // Only persist completed/failed audit workspaces — never filename-only snapshots.
      if (!data?.result && !data?.sheetError) return false;

      const transform = optionsRef.current.transform;
      const payloadToStore = transform ? transform(data) : data;
      const resultSig = data.result
        ? `${data.result.auditRunId ?? ''}:${data.result.totalRows ?? ''}:${data.result.errorRows ?? ''}`
        : '';
      const persistKey = `${registryKey}:${data.fileName ?? ''}:${Boolean(data.result)}:${Boolean(data.sheetError)}:${data.activeFilter ?? ''}:${resultSig}`;

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

    const local = loadAuditSession(registryKey);
    if (local?.data) {
      const snap = snapshotRef.current;
      const alreadyHasWorkspace = Boolean(snap?.result || snap?.sheetError);
      const localHasWorkspace = Boolean(local.data?.result || local.data?.sheetError);
      if (localHasWorkspace && !alreadyHasWorkspace) {
        applySessionPayload(local.data);
      }
      updateSessionMeta({ savedAt: local.savedAt, expiresAt: local.expiresAt });
      return undefined;
    }

    if (generation === mountGenerationRef.current) {
      updateSessionMeta(null);
    }

    return undefined;
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
      const local = loadAuditSession(registryKey);
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

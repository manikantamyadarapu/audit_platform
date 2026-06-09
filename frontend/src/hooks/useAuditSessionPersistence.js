import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuditSessionConfig } from '../config/auditSessionConfig';
import {
  clearAuditSessionRemote,
  restoreAuditSession,
  saveAuditSessionRemote,
} from '../services/auditSessionService';
import { getAuthToken } from '../utils/authUser';
import {
  clearAuditSession,
  formatSavedSessionLabel,
  loadAuditSession,
  readAuditSessionMeta,
  saveAuditSession,
} from '../utils/auditSessionStorage';

const SERVER_SAVE_DEBOUNCE_MS = 800;

function metaEquals(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.savedAt === b.savedAt && a.expiresAt === b.expiresAt;
}

/**
 * Persist audit page state for ONE audit type only (localStorage + database, 7-day TTL).
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
  const config = getAuditSessionConfig(registryKey);

  const [sessionMeta, setSessionMeta] = useState(() => readAuditSessionMeta(registryKey));
  const [restoring, setRestoring] = useState(false);

  const snapshotRef = useRef(snapshot);
  const serverSaveTimerRef = useRef(null);
  const mountGenerationRef = useRef(0);
  const hydratedRef = useRef(false);
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

  const scheduleRemoteSave = useCallback(
    (data, auditRunId = null) => {
      if (!config || !getAuthToken()) return;

      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
      }

      serverSaveTimerRef.current = setTimeout(async () => {
        try {
          const resolvedAuditRunId =
            auditRunId ?? data?.result?.auditRunId ?? data?.auditRunId ?? null;

          await saveAuditSessionRemote({
            auditCode: config.auditCode,
            pageRoute: config.pageRoute,
            auditRunId: resolvedAuditRunId,
            fileName: data?.fileName ?? null,
            status: data?.sheetError ? 'FAILED' : data?.result ? 'COMPLETED' : 'PROCESSING',
            sessionData: data,
          });
        } catch {
          /* best-effort */
        }
      }, SERVER_SAVE_DEBOUNCE_MS);
    },
    [config]
  );

  const persist = useCallback(
    (data = snapshotRef.current, auditRunId = null) => {
      if (!data?.result && !data?.sheetError && !data?.fileName) return false;

      const transform = optionsRef.current.transform;
      const persistKey = `${registryKey}:${data.fileName ?? ''}:${Boolean(data.result)}:${Boolean(data.sheetError)}:${data.activeFilter ?? ''}`;
      if (persistKey === lastPersistKeyRef.current) return true;
      lastPersistKeyRef.current = persistKey;

      const ok = saveAuditSession(registryKey, data, { transform });
      if (ok) {
        updateSessionMeta(readAuditSessionMeta(registryKey));
        scheduleRemoteSave(data, auditRunId);
        return true;
      }

      optionsRef.current.onSaveFailed?.();
      scheduleRemoteSave(data, auditRunId);
      return false;
    },
    [registryKey, scheduleRemoteSave, updateSessionMeta]
  );

  const fetchRemoteSession = useCallback(async () => {
    if (!config || !getAuthToken()) return null;

    const response = await restoreAuditSession({ auditCode: config.auditCode });
    const session = response?.data;
    if (!session?.results) return null;

    if (session.pageRoute && session.pageRoute !== config.pageRoute) {
      return null;
    }

    return session;
  }, [config]);

  const hydrateFromRemote = useCallback(
    async (generation) => {
      const session = await fetchRemoteSession();
      if (generation !== mountGenerationRef.current || !session?.results) return null;

      const savedAt = session.savedAt ? new Date(session.savedAt).getTime() : Date.now();
      const expiresAt = session.expiresAt
        ? new Date(session.expiresAt).getTime()
        : savedAt + 7 * 24 * 60 * 60 * 1000;

      saveAuditSession(registryKey, session.results, {
        transform: optionsRef.current.transform,
      });
      updateSessionMeta({ savedAt, expiresAt });
      applySessionPayload(session.results);
      hydratedRef.current = true;
      return session.results;
    },
    [fetchRemoteSession, registryKey, applySessionPayload, updateSessionMeta]
  );

  // Hydrate this audit workspace once on mount (local first, then DB)
  useEffect(() => {
    const generation = ++mountGenerationRef.current;
    hydratedRef.current = false;
    lastPersistKeyRef.current = '';

    if (serverSaveTimerRef.current) {
      clearTimeout(serverSaveTimerRef.current);
      serverSaveTimerRef.current = null;
    }

    const local = loadAuditSession(registryKey);
    if (local?.data) {
      applySessionPayload(local.data);
      updateSessionMeta({ savedAt: local.savedAt, expiresAt: local.expiresAt });
      hydratedRef.current = true;
      return undefined;
    }

    updateSessionMeta(null);

    let cancelled = false;
    (async () => {
      try {
        await hydrateFromRemote(generation);
      } catch {
        /* fresh workspace */
      } finally {
        if (!cancelled && generation === mountGenerationRef.current) {
          updateSessionMeta(readAuditSessionMeta(registryKey));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [registryKey, applySessionPayload, hydrateFromRemote, updateSessionMeta]);

  // Auto-save when snapshot changes — persist() dedupes identical writes
  useEffect(() => {
    if (!snapshot?.result && !snapshot?.sheetError && !snapshot?.fileName) return;
    persist(snapshot);
  }, [registryKey, snapshot, persist]);

  // Flush on unmount only
  useEffect(() => {
    return () => {
      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
      }
      lastPersistKeyRef.current = '';
      persist(snapshotRef.current);
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
        return;
      }
      await hydrateFromRemote(mountGenerationRef.current);
    } finally {
      setRestoring(false);
    }
  }, [registryKey, applySessionPayload, hydrateFromRemote, updateSessionMeta]);

  const startNewAudit = useCallback(async () => {
    setRestoring(true);
    try {
      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
        serverSaveTimerRef.current = null;
      }

      lastPersistKeyRef.current = '';
      clearAuditSession(registryKey);
      if (config && getAuthToken()) {
        try {
          await clearAuditSessionRemote({ auditCode: config.auditCode });
        } catch {
          /* ignore */
        }
      }
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
  }, [registryKey, config, applySessionPayload, updateSessionMeta]);

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

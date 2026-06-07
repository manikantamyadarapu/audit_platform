import { useCallback, useEffect, useRef, useState } from 'react';
import {
  formatSavedSessionLabel,
  readAuditSessionMeta,
  saveAuditSession,
} from '../utils/auditSessionStorage';

/**
 * Persist audit page state across tab/route switches (localStorage, 7-day TTL).
 *
 * @template T
 * @param {string} storageKey
 * @param {T} snapshot - current state to persist (useMemo)
 * @param {{ transform?: (data: T) => T, onSaveFailed?: () => void }} [options]
 */
export function useAuditSessionPersistence(storageKey, snapshot, options = {}) {
  const { transform, onSaveFailed } = options;
  const [sessionMeta, setSessionMeta] = useState(() => readAuditSessionMeta(storageKey));
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const persist = useCallback(
    (data = snapshotRef.current) => {
      if (!data?.result && !data?.sheetError) return false;
      const ok = saveAuditSession(storageKey, data, { transform });
      if (ok) {
        setSessionMeta(readAuditSessionMeta(storageKey));
        return true;
      }
      onSaveFailed?.();
      return false;
    },
    [storageKey, transform, onSaveFailed]
  );

  useEffect(() => {
    if (!snapshot?.result && !snapshot?.sheetError) return;
    persist(snapshot);
  }, [storageKey, snapshot, persist]);

  useEffect(() => {
    return () => {
      persist(snapshotRef.current);
    };
  }, [storageKey, persist]);

  const sessionLabel = sessionMeta
    ? formatSavedSessionLabel(sessionMeta.savedAt, sessionMeta.expiresAt)
    : '';

  return { sessionLabel, persist };
}

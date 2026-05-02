import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AppUiContext = createContext(null);

const seedActivities = [
  { id: '1', text: 'PAN workbook uploaded · Finance batch Q4', tone: 'info' },
  { id: '2', text: '1,240 rows processed · Scrutiny pipeline', tone: 'info' },
  { id: '3', text: '305 variance rows flagged for review', tone: 'warn' },
  { id: '4', text: 'Invalid-row export downloaded (.xlsx)', tone: 'success' },
];

export function AppUiProvider({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [division, setDivision] = useState('scrutiny');
  const [sessionStats, setSessionStats] = useState({
    filesProcessed: 0,
    rowsProcessed: 0,
    errorsFound: 0,
    exportsDownloaded: 0,
  });
  const [activities, setActivities] = useState(seedActivities);

  const pushActivity = useCallback((text, tone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setActivities((prev) => [{ id, text, tone }, ...prev].slice(0, 12));
  }, []);

  const recordPanValidation = useCallback(
    (payload) => {
      setSessionStats((prev) => ({
        filesProcessed: prev.filesProcessed + 1,
        rowsProcessed: prev.rowsProcessed + (payload.totalRows ?? 0),
        errorsFound: prev.errorsFound + (payload.errorRows ?? 0),
        exportsDownloaded: prev.exportsDownloaded,
      }));
      pushActivity(
        `PAN validated · ${payload.totalRows ?? 0} rows · ${payload.errorRows ?? 0} error rows`,
        (payload.errorRows ?? 0) > 0 ? 'warn' : 'success'
      );
    },
    [pushActivity]
  );

  const recordExport = useCallback(() => {
    setSessionStats((prev) => ({
      ...prev,
      exportsDownloaded: prev.exportsDownloaded + 1,
    }));
    pushActivity('Invalid PAN rows exported to Excel', 'success');
  }, [pushActivity]);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      division,
      setDivision,
      sessionStats,
      activities,
      recordPanValidation,
      recordExport,
    }),
    [sidebarCollapsed, division, sessionStats, activities, recordPanValidation, recordExport]
  );

  return <AppUiContext.Provider value={value}>{children}</AppUiContext.Provider>;
}

export function useAppUi() {
  const ctx = useContext(AppUiContext);
  if (!ctx) throw new Error('useAppUi must be used within AppUiProvider');
  return ctx;
}

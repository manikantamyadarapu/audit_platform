import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppShellSkeleton } from '../layout/AppShellSkeleton';
import { fetchCurrentUser, getAuthToken } from '../../utils/authUser';

export function SessionBootstrap() {
  const [ready, setReady] = useState(() => !getAuthToken());

  useEffect(() => {
    if (!getAuthToken()) {
      setReady(true);
      return undefined;
    }

    let cancelled = false;

    fetchCurrentUser()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <AppShellSkeleton variant="dashboard" />;
  }

  return <Outlet />;
}

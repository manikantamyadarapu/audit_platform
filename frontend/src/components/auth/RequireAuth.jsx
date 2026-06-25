import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppShellSkeleton } from '../layout/AppShellSkeleton';
import { bootstrapAuthSession } from '../../utils/authUser';

/**
 * Blocks all child routes until a valid session exists.
 * Missing or invalid tokens redirect to /login.
 */
export function RequireAuth() {
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    bootstrapAuthSession().then((ok) => {
      if (!cancelled) setStatus(ok ? 'authed' : 'guest');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return <AppShellSkeleton variant="dashboard" />;
  }

  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { LoginSkeleton } from '../layout/LoginSkeleton';
import { bootstrapAuthSession } from '../../utils/authUser';

/**
 * Login / forgot-password only — redirect to dashboard when already authenticated.
 */
export function GuestRoute() {
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
    return <LoginSkeleton />;
  }

  if (status === 'authed') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

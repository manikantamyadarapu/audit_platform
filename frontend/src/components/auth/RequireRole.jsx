import { Navigate, Outlet } from 'react-router-dom';
import { getStoredUser } from '../../utils/authUser';

/**
 * Restrict nested routes to one or more roles (case-insensitive).
 * Must be nested under RequireAuth.
 */
export function RequireRole({ roles }) {
  const user = getStoredUser();
  const allowed = (roles || []).map((r) => String(r).toUpperCase());
  const role = String(user?.role || '').toUpperCase();

  if (!allowed.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

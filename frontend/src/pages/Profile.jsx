import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail,
  Shield,
  UserCircle,
  Calendar,
  Hash,
  Loader2,
  Settings,
  BadgeCheck,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  fetchCurrentUser,
  formatRoleLabel,
  getStoredUser,
  getUserInitials,
} from '../utils/authUser';
import { cn } from '../utils/cn';

function roleBadgeClass(role) {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-200/80';
  }
  if (r === 'AUDITOR') return 'bg-amber-100 text-amber-800 ring-amber-200/80';
  return 'bg-slate-100 text-slate-700 ring-slate-200/80';
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-elevated)] text-emerald-700 ring-1 ring-[var(--color-border-soft)]">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
        <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)] break-words">{value ?? '—'}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fresh = await fetchCurrentUser();
      setUser(fresh ?? getStoredUser());
    } catch (e) {
      setError(e.message || 'Could not load profile');
      setUser(getStoredUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const initials = getUserInitials(user?.name);
  const createdLabel = user?.createdAt
    ? new Date(user.createdAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';

  return (
    <div className="pb-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 pt-1"
      >
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your account details for the Audit Platform workspace.
        </p>
      </motion.div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200/70 bg-white py-20 shadow-[var(--shadow-glass)]">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error} — showing last saved session data.
        </div>
      ) : null}

      {!loading && user ? (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardBody className="p-0">
              <div className="bg-gradient-to-br from-emerald-600/10 via-white to-slate-50 px-6 py-8 sm:px-8">
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-600 text-2xl font-semibold text-white shadow-[0_18px_45px_rgba(5,150,105,0.35)] ring-4 ring-white">
                    {initials}
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-xl font-semibold text-slate-900">{user.name}</h3>
                    <p className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-600 sm:justify-start">
                      <Mail className="h-4 w-4 shrink-0 text-emerald-600" />
                      {user.email}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1',
                          roleBadgeClass(user.role)
                        )}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {formatRoleLabel(user.role)}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1',
                          user.isActive !== false
                            ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
                            : 'bg-rose-50 text-rose-800 ring-rose-200/80'
                        )}
                      >
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {user.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  <Link to="/settings" className="shrink-0">
                    <Button variant="secondary" size="md">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Button>
                  </Link>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Account details</h3>
            </CardHeader>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailRow icon={Hash} label="User ID" value={String(user.id ?? '—')} />
                <DetailRow icon={UserCircle} label="Full name" value={user.name} />
                <DetailRow icon={Mail} label="Email address" value={user.email} />
                <DetailRow icon={Shield} label="Role" value={formatRoleLabel(user.role)} />
                <DetailRow icon={Calendar} label="Member since" value={createdLabel} />
                <DetailRow
                  icon={BadgeCheck}
                  label="Account status"
                  value={user.isActive !== false ? 'Active' : 'Inactive'}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="text-base font-semibold text-slate-900">Workspace access</h3>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-slate-600 leading-relaxed">
                Your role controls which scrutiny modules and admin tools you can use. Contact an
                administrator on the{' '}
                <Link to="/users" className="font-medium text-emerald-700 hover:text-emerald-800">
                  Users
                </Link>{' '}
                page if you need a role or password change.
              </p>
            </CardBody>
          </Card>
        </div>
      ) : !loading ? (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-600">No profile data found. Please sign in again.</p>
            <Link to="/login" className="mt-4 inline-block text-sm font-medium text-emerald-700">
              Go to login
            </Link>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

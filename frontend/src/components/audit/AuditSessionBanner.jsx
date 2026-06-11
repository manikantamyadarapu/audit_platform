import { RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { AUDIT_SESSION_RETENTION_DAYS, daysUntilExpiry } from '../../utils/auditSessionStorage';

/**
 * Banner shown when a saved audit session is available.
 */
export function AuditSessionBanner({
  sessionMeta,
  sessionLabel,
  hasResults,
  onRestore,
  onStartNew,
  restoring = false,
}) {
  if (!hasResults) return null;

  const daysLeft = sessionMeta ? daysUntilExpiry(sessionMeta.expiresAt) : AUDIT_SESSION_RETENTION_DAYS;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-emerald-900 dark:text-emerald-200">
        {sessionLabel ? (
          <p>{sessionLabel}</p>
        ) : (
          <p>Previous audit results restored.</p>
        )}
        {daysLeft > 0 ? (
          <p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80">
            Kept for {daysLeft} more day{daysLeft === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={restoring}
          onClick={onRestore}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restore Results
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={restoring}
          onClick={onStartNew}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Start New Audit
        </Button>
      </div>
    </div>
  );
}

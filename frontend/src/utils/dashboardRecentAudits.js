/**
 * @param {import('../types/dashboard').DashboardAuditStatus | string} status
 */
export function getAuditStatusMeta(status) {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED':
      return {
        label: 'Completed',
        className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      };
    case 'PROCESSING':
      return {
        label: 'In Progress',
        className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      };
    case 'PENDING':
      return {
        label: 'Pending',
        className: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300',
      };
    case 'FAILED':
      return {
        label: 'Failed',
        className: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      };
    default:
      return {
        label: status || 'Unknown',
        className: 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]',
      };
  }
}

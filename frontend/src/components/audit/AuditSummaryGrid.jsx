import { cn } from '../../utils/cn';

/**
 * Responsive grid for audit intelligence summary widgets.
 */
export function AuditSummaryGrid({ children, className }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function AuditSummaryGroup({ title, children, className }) {
  return (
    <div className={cn('space-y-3', className)}>
      {title ? (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {title}
        </p>
      ) : null}
      <AuditSummaryGrid>{children}</AuditSummaryGrid>
    </div>
  );
}

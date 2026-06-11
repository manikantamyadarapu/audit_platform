import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';

export function EmptyState({ icon: Icon = Inbox, title, description, className, children }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[18px] border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-subtle)] px-8 py-16 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-elevated)] text-[var(--color-text-faint)] ring-1 ring-[var(--color-border-soft)] shadow-sm">
        <Icon className="h-8 w-8" strokeWidth={1.25} />
      </div>
      <h3 className="mt-5 text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-text-muted)]">{description}</p>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

import { cn } from '../../utils/cn';

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-5 py-3 text-sm text-[var(--color-text-primary)] shadow-[var(--shadow-glass)] outline-none transition placeholder:text-[var(--color-text-faint)] focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15',
        className
      )}
      {...props}
    />
  );
}

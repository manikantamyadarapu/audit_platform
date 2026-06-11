import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98]',
  secondary:
    'border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)] active:scale-[0.98]',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)] active:scale-[0.98]',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 active:scale-[0.98]',
};

const sizes = {
  sm: 'h-9 px-4 text-xs rounded-full gap-1.5',
  md: 'h-12 px-5 text-sm rounded-full gap-2.5',
  lg: 'h-14 px-6 text-sm rounded-full gap-3',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <span
          className={cn(
            'h-4 w-4 animate-spin rounded-full border-2 border-t-transparent',
            variant === 'primary' || variant === 'danger'
              ? 'border-white/35 border-t-white'
              : 'border-[var(--color-border-strong)] border-t-emerald-500 dark:border-t-emerald-400'
          )}
        />
      ) : null}
      {children}
    </button>
  );
}

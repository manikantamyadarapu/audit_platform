import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600 hover:shadow-emerald-500/25 active:scale-[0.98]',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:bg-slate-50/90 active:scale-[0.98]',
  ghost: 'text-slate-600 hover:bg-slate-100 active:scale-[0.98]',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-500/15 active:scale-[0.98]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-[11px] gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-[13px] gap-2',
  lg: 'px-5 py-3 text-sm rounded-[14px] gap-2',
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
        'inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50',
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
              : 'border-slate-300 border-t-emerald-600'
          )}
        />
      ) : null}
      {children}
    </button>
  );
}

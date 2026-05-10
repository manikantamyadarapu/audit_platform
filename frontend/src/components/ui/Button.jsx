import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.24)] hover:bg-emerald-600 hover:shadow-[0_12px_28px_rgba(16,185,129,0.28)] active:scale-[0.98]',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.08)] hover:border-slate-300 hover:bg-slate-50/90 active:scale-[0.98]',
  ghost: 'text-slate-600 hover:bg-slate-100 active:scale-[0.98]',
  danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-[0_10px_24px_rgba(244,63,94,0.22)] active:scale-[0.98]',
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

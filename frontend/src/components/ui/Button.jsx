import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-emerald-500/90 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-emerald-500 hover:shadow-[0_3px_10px_rgba(15,23,42,0.08)] active:bg-emerald-600/90',
  secondary:
    'border border-slate-200 bg-white/95 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-[0_2px_8px_rgba(15,23,42,0.05)] active:bg-slate-100/80',
  ghost: 'text-slate-600 hover:bg-slate-100/70 active:bg-slate-100',
  danger:
    'bg-rose-500/90 text-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] hover:bg-rose-500 hover:shadow-[0_3px_10px_rgba(15,23,42,0.08)] active:bg-rose-600/90',
};

const sizes = {
  sm: 'h-9 px-4 text-xs rounded-xl gap-1.5',
  md: 'h-12 px-5 text-sm rounded-xl gap-2.5',
  lg: 'h-14 px-6 text-sm rounded-xl gap-3',
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
        'inline-flex items-center justify-center font-semibold transition-[background-color,border-color,box-shadow,color,opacity] duration-200 ease-out disabled:pointer-events-none disabled:opacity-[0.68]',
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

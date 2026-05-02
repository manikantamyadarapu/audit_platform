import { cn } from '../../utils/cn';

const variants = {
  primary:
    'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 hover:brightness-[1.03] active:scale-[0.98]',
  secondary:
    'bg-white/80 backdrop-blur-sm text-slate-800 border border-slate-200/80 shadow-sm hover:bg-white hover:border-slate-300',
  ghost: 'text-slate-600 hover:bg-slate-100/80',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-500/20',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-5 py-3 text-sm rounded-xl gap-2',
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
        'inline-flex items-center justify-center font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none',
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
              : 'border-slate-300 border-t-blue-600'
          )}
        />
      ) : null}
      {children}
    </button>
  );
}

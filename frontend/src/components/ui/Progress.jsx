import { cn } from '../../utils/cn';

export function Progress({ value = 0, className, indicatorClassName }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200/90', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-[width] duration-500 ease-out',
          indicatorClassName
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

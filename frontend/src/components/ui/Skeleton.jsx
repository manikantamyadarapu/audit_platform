import { cn } from '../../utils/cn';

/**
 * Shadcn-style skeleton with enterprise shimmer (glassmorphism-friendly).
 * @param {'default' | 'glass' | 'muted'} [variant]
 */
export function Skeleton({ className, variant = 'default', ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'skeleton-shimmer',
        variant === 'glass' && 'skeleton-glass',
        variant === 'muted' && 'skeleton-muted',
        className
      )}
      {...props}
    />
  );
}

/** Circular avatar / icon placeholder */
export function SkeletonCircle({ className, size = 'md', ...props }) {
  const sizeClass =
    size === 'sm'
      ? 'h-8 w-8'
      : size === 'lg'
        ? 'h-16 w-16'
        : size === 'xl'
          ? 'h-[210px] w-[210px]'
          : 'h-10 w-10';

  return <Skeleton className={cn('rounded-full', sizeClass, className)} {...props} />;
}

/**
 * Multi-line text placeholder (Shadcn pattern).
 * @param {{ lines?: number, lastLineWidth?: string, className?: string }} props
 */
export function SkeletonText({ lines = 1, lastLineWidth = 'w-3/5', className }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn(
            'h-3.5 rounded-md',
            index === lines - 1 && lines > 1 ? lastLineWidth : 'w-full'
          )}
        />
      ))}
    </div>
  );
}

/** Glass panel wrapper with inner shimmer blocks */
export function SkeletonGlassPanel({ className, children, ...props }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/40 bg-white/25 shadow-[var(--shadow-glass)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/25',
        className
      )}
      aria-hidden="true"
      {...props}
    >
      {children}
    </div>
  );
}

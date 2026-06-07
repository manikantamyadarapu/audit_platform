import { Skeleton, SkeletonGlassPanel } from '../ui/Skeleton';
import { cn } from '../../utils/cn';

/**
 * Enterprise chart loading placeholder with shimmer bars / area silhouette.
 * @param {{ height?: number, variant?: 'area' | 'bar' | 'donut', className?: string }} props
 */
export function ChartSkeleton({ height = 320, variant = 'area', className }) {
  if (variant === 'donut') {
    return (
      <div className={cn('flex items-center gap-6', className)} aria-hidden="true" role="presentation">
        <Skeleton variant="glass" className="h-[210px] w-[210px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 flex-1 max-w-[9rem] rounded-md" />
              <Skeleton className="h-6 w-10 rounded-full" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'bar') {
    return (
      <SkeletonGlassPanel className={cn('relative p-4', className)} style={{ minHeight: height }}>
        <div className="mb-4 flex justify-center gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-16 rounded-md" />
          ))}
        </div>
        <Skeleton variant="glass" className="mx-auto h-12 w-[88%] rounded-xl" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
      </SkeletonGlassPanel>
    );
  }

  // area chart (default)
  return (
    <SkeletonGlassPanel
      className={cn('relative overflow-hidden p-4 sm:p-5', className)}
      style={{ minHeight: height }}
    >
      <div className="mb-5 flex justify-center gap-6">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-3 w-20 rounded-md" />
      </div>
      <div className="flex h-[calc(100%-2.5rem)] min-h-[220px] items-end gap-2 px-2 pb-6">
        {[42, 58, 48, 72, 55, 68, 52, 78, 62, 70, 58, 65].map((pct, index) => (
          <Skeleton
            key={index}
            variant="glass"
            className="flex-1 rounded-t-lg"
            style={{ height: `${pct}%`, opacity: 0.55 + (index % 3) * 0.12 }}
          />
        ))}
      </div>
      <div className="absolute inset-x-4 bottom-4 flex justify-between">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-2.5 w-8 rounded-md" />
        ))}
      </div>
    </SkeletonGlassPanel>
  );
}

/** Summary strip KPI placeholders (4 columns) */
export function SummaryStripSkeleton({ columns = 4 }) {
  return (
    <div className="grid gap-0 md:grid-cols-4" aria-hidden="true">
      {Array.from({ length: columns }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'space-y-3 px-8 py-2',
            index > 0 && 'border-t border-[var(--color-border-soft)] md:border-l md:border-t-0'
          )}
        >
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Recent audits table row skeleton */
export function TableRowSkeleton({ columns = 5 }) {
  return (
    <tr className="border-b border-[var(--color-border-soft)] last:border-0">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="py-3.5">
          <Skeleton
            className={cn(
              'h-4 rounded-md',
              index === 0 && 'w-[min(100%,14rem)]',
              index === columns - 1 && 'ml-auto w-16',
              index > 0 && index < columns - 1 && 'w-20'
            )}
          />
        </td>
      ))}
    </tr>
  );
}

import { cn } from '../../utils/cn';

export function Skeleton({ className, ...props }) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-shimmer rounded-lg', className)}
      {...props}
    />
  );
}

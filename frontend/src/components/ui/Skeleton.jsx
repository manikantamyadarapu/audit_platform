import { cn } from '../../utils/cn';

export function Skeleton({ className }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-shimmer',
        className
      )}
    />
  );
}

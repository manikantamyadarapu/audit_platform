import { Skeleton } from '../ui/Skeleton';

export function LoginSkeleton() {
  return (
    <div
      className="flex min-h-svh w-full items-center justify-center bg-[var(--color-surface-page)] px-4 py-10"
      role="status"
      aria-live="polite"
      aria-label="Loading login"
    >
      <div className="w-full max-w-[420px] space-y-8">
        <div className="mx-auto flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-4 w-64 rounded-lg" />
        </div>

        <div className="rounded-3xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-8 shadow-[var(--shadow-glass)]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
            <Skeleton className="h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading login…</span>
    </div>
  );
}

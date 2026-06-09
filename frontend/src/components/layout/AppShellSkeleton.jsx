import { Skeleton } from '../ui/Skeleton';
import { ChartSkeleton, SummaryStripSkeleton } from '../ui/ChartSkeleton';
import { cn } from '../../utils/cn';

function SidebarSkeleton() {
  return (
    <aside
      aria-hidden="true"
      className="sticky top-0 z-20 flex h-svh w-[280px] shrink-0 flex-col border-r border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-glass)]"
    >
      <div className="flex items-center justify-between gap-3 px-6 pb-4 pt-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-14 rounded-md" />
          <Skeleton className="h-3 w-36 rounded-md" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-6 pb-6">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton
            key={index}
            className={cn('h-11 rounded-lg', index > 2 && index < 6 && 'ml-3 w-[calc(100%-0.75rem)]')}
          />
        ))}
      </nav>

      <div className="border-t border-[var(--color-border-soft)] px-6 py-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBarSkeleton() {
  return (
    <header className="sticky top-0 z-10 h-20 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-overlay)] backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-5 sm:px-8">
        <Skeleton className="h-4 w-48 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-14 w-40 rounded-full" />
        </div>
      </div>
    </header>
  );
}

function DashboardContentSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-72 max-w-full rounded-xl" />
          <Skeleton className="h-5 w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-14 w-14 rounded-full" />
          <Skeleton className="h-14 w-14 rounded-full" />
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-7 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-6 w-36 rounded-lg" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-12 w-28 rounded-full" />
          <Skeleton className="h-12 w-32 rounded-full" />
          <Skeleton className="h-12 w-40 rounded-full" />
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-glass)]"
          >
            <div className="flex items-center gap-5">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-4 w-40 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-6 py-5 shadow-[var(--shadow-glass)]">
        <SummaryStripSkeleton columns={4} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-glass)]">
          <div className="border-b border-[var(--color-border-soft)] px-6 py-5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40 rounded-lg" />
              <Skeleton className="h-11 w-24 rounded-full" />
            </div>
          </div>
          <div className="px-3 py-4 sm:px-5">
            <ChartSkeleton height={320} variant="area" />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-glass)]">
          <Skeleton className="mb-6 h-6 w-44 rounded-lg" />
          <ChartSkeleton variant="donut" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-glass)]">
          <Skeleton className="mb-5 h-6 w-48 rounded-lg" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-5 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-glass)]">
          <Skeleton className="mb-2 h-6 w-36 rounded-lg" />
          <Skeleton className="mb-4 h-3 w-48 rounded-md" />
          <ChartSkeleton height={320} variant="bar" />
        </div>
      </div>
    </div>
  );
}

function DefaultContentSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-8 w-56 max-w-full rounded-xl" />
        <Skeleton className="h-5 w-80 max-w-full rounded-lg" />
      </div>

      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-6 shadow-[var(--shadow-glass)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-10 w-72 max-w-full rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{ variant?: 'dashboard' | 'default', showTopBar?: boolean }} props
 */
export function PageContentSkeleton({ variant = 'default', showTopBar = false }) {
  return (
    <div className="w-full">
      {showTopBar ? <TopBarSkeleton /> : null}
      {variant === 'dashboard' ? <DashboardContentSkeleton /> : <DefaultContentSkeleton />}
    </div>
  );
}

/**
 * Full application shell skeleton — sidebar + main content.
 * @param {{ variant?: 'dashboard' | 'default' }} props
 */
export function AppShellSkeleton({ variant = 'dashboard' }) {
  const isDashboard = variant === 'dashboard';

  return (
    <div
      className="flex min-h-svh w-full bg-transparent text-[var(--color-text-primary)]"
      role="status"
      aria-live="polite"
      aria-label="Loading application"
    >
      <SidebarSkeleton />
      <div className="flex min-h-svh min-w-0 flex-1 flex-col">
        {!isDashboard ? <TopBarSkeleton /> : null}
        <main className="relative flex-1 overflow-x-hidden bg-transparent px-5 py-6 lg:px-7">
          <PageContentSkeleton variant={variant} />
        </main>
      </div>
      <span className="sr-only">Loading application…</span>
    </div>
  );
}

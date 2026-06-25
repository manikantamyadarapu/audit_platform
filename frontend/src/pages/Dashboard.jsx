import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  FileSpreadsheet,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { NotificationBell } from '../components/layout/NotificationBell';
import { Skeleton } from '../components/ui/Skeleton';
import { SummaryStripSkeleton, TableRowSkeleton } from '../components/ui/ChartSkeleton';
import { useCurrentDateTime } from '../utils/dateTime';
import { getStoredUser } from '../utils/authUser';
import { fetchDashboardWidgets, fetchDashboardAuditTrend, fetchDashboardIssuesCategory, fetchDashboardRecentAudits, getDashboardWidgetsErrorMessage } from '../services/dashboardService';
import { AuditActivityTrendChart } from '../components/charts/AuditActivityTrendChart';
import { IssuesByCategoryPanel } from '../components/charts/IssuesByCategoryPanel';
import {
  buildDashboardKpiItems,
  buildSummaryStripItems,
  DASHBOARD_PERIOD_OPTIONS,
} from '../utils/dashboardWidgets';
import { buildIssueCategoryItems } from '../utils/dashboardIssueCategories';
import { getAuditStatusMeta } from '../utils/dashboardRecentAudits';
import { formatUploadDateTime } from '../utils/dateTime';
import { formatNumber } from '../utils/format';
import { loadAuditSession, saveAuditSession } from '../utils/auditSessionStorage';

const DASHBOARD_UI_KEY = 'dashboard-ui';

const KPI_ICONS = {
  totalAudits: FileSpreadsheet,
  totalRecords: ShieldCheck,
  totalIssues: AlertTriangle,
  accuracy: ShieldCheck,
};

const RECENT_AUDITS_PAGE_SIZE = 5;

function Panel({ children, className = '' }) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-[var(--shadow-glass)]',
        className
      )}
    >
      {children}
    </section>
  );
}

function ButtonPill({ children, className = '', onClick, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-12 items-center gap-3 rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const PERIOD_TOGGLE_SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 };

function DashboardPeriodToggle({ period, onChange }) {
  const containerRef = useRef(null);
  const [indicator, setIndicator] = useState(null);

  const updateIndicator = useCallback(() => {
    const container = containerRef.current;
    const active = container?.querySelector(`[data-period="${period}"]`);
    if (!container || !active) return;

    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    setIndicator({
      left: activeRect.left - containerRect.left,
      width: activeRect.width,
    });
  }, [period]);

  useLayoutEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex h-12 items-center rounded-full border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-1"
      role="group"
      aria-label="Audit overview period"
    >
      {indicator ? (
        <motion.div
          className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-emerald-600 shadow-sm"
          initial={false}
          animate={{ left: indicator.left, width: indicator.width }}
          transition={PERIOD_TOGGLE_SPRING}
          aria-hidden
        />
      ) : null}
      {DASHBOARD_PERIOD_OPTIONS.map((option) => {
        const isActive = period === option.id;
        return (
          <button
            key={option.id}
            type="button"
            data-period={option.id}
            onClick={() => onChange(option.id)}
            aria-pressed={isActive}
            className={cn(
              'relative z-10 h-10 rounded-full px-5 text-sm font-semibold transition-colors duration-300 ease-out',
              isActive
                ? 'text-white'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function trendToneClass(tone) {
  if (tone === 'down') return 'text-red-500';
  if (tone === 'up') return 'text-emerald-600';
  return 'text-[var(--color-text-muted)]';
}

function KpiCard({ item, loading }) {
  const Icon = KPI_ICONS[item.key] || FileSpreadsheet;
  const toneClasses = {
    green: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400',
    red: 'bg-red-100 text-red-500 dark:bg-red-950/40 dark:text-red-400',
  };

  return (
    <Panel className="p-6">
      <div className="flex items-center gap-5">
        <div className={cn('flex h-16 w-16 items-center justify-center rounded-full', toneClasses[item.tone])}>
          {loading ? (
            <Skeleton variant="glass" className="h-16 w-16 rounded-full" />
          ) : (
            <Icon className="h-7 w-7" strokeWidth={1.8} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--color-text-secondary)]">{item.label}</p>
          {loading ? (
            <div className="mt-3 space-y-3">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-4 w-40 rounded-md" />
            </div>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">{item.value}</p>
              <p className={cn('mt-4 text-sm', trendToneClass(item.trend?.tone))}>{item.trend?.text}</p>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

export default function Dashboard() {
  const { greeting, shortDate } = useCurrentDateTime();
  const storedUser = getStoredUser();
  const displayName = storedUser?.name?.split(/\s+/)[0] || 'Admin';

  const [period, setPeriod] = useState(() => {
    const saved = loadAuditSession(DASHBOARD_UI_KEY);
    return saved?.data?.period ?? 'week';
  });
  const [widgets, setWidgets] = useState(null);
  const [auditTrend, setAuditTrend] = useState(null);
  const [issuesCategory, setIssuesCategory] = useState(null);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [issuesCategoryLoading, setIssuesCategoryLoading] = useState(true);
  const [recentAudits, setRecentAudits] = useState([]);
  const [recentAuditsLoading, setRecentAuditsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadDashboard = useCallback(async (selectedPeriod) => {
    const requestId = ++requestIdRef.current;
    const isInitial = !hasLoadedRef.current;

    if (isInitial) {
      setWidgetsLoading(true);
      setTrendLoading(true);
      setIssuesCategoryLoading(true);
      setRecentAuditsLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [widgetsResult, trendResult, issuesResult, recentResult] = await Promise.allSettled([
        fetchDashboardWidgets(selectedPeriod),
        fetchDashboardAuditTrend(selectedPeriod),
        fetchDashboardIssuesCategory(selectedPeriod),
        fetchDashboardRecentAudits({
          page: 1,
          limit: RECENT_AUDITS_PAGE_SIZE,
          period: selectedPeriod,
        }),
      ]);

      if (requestId !== requestIdRef.current) {
        return;
      }

      let hadError = false;

      if (widgetsResult.status === 'fulfilled') {
        setWidgets(widgetsResult.value);
      } else {
        hadError = true;
      }

      if (trendResult.status === 'fulfilled') {
        setAuditTrend(trendResult.value);
      } else {
        hadError = true;
      }

      if (issuesResult.status === 'fulfilled') {
        setIssuesCategory(issuesResult.value);
      } else {
        hadError = true;
      }

      if (recentResult.status === 'fulfilled') {
        setRecentAudits(recentResult.value.items ?? []);
      } else {
        hadError = true;
      }

      if (hadError) {
        toast.error(getDashboardWidgetsErrorMessage(new Error('Failed to refresh dashboard')));
      }

      hasLoadedRef.current = true;
    } finally {
      if (requestId === requestIdRef.current) {
        setWidgetsLoading(false);
        setTrendLoading(false);
        setIssuesCategoryLoading(false);
        setRecentAuditsLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadDashboard(period);
  }, [period, loadDashboard]);

  const refreshDashboard = useCallback(() => {
    loadDashboard(period);
  }, [period, loadDashboard]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboard();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshDashboard]);

  useEffect(() => {
    saveAuditSession(DASHBOARD_UI_KEY, { period });
  }, [period]);

  const kpiItems = useMemo(() => buildDashboardKpiItems(widgets), [widgets]);
  const summaryItems = useMemo(() => buildSummaryStripItems(widgets), [widgets]);
  const issueCategoryItems = useMemo(() => {
    const items = buildIssueCategoryItems(issuesCategory);
    return [...items].sort((a, b) => b.value - a.value).slice(0, 5);
  }, [issuesCategory]);
  const totalIssuesCount = issuesCategory?.totalIssues ?? widgets?.totalIssues?.value ?? 0;
  const showWidgetsSkeleton = widgetsLoading && !widgets;
  const showTrendSkeleton = trendLoading && !auditTrend;
  const showIssuesSkeleton = issuesCategoryLoading && !issuesCategory;
  const showRecentSkeleton = recentAuditsLoading && !recentAudits.length;

  const handlePeriodChange = useCallback((nextPeriod) => {
    if (nextPeriod === period) return;
    startTransition(() => setPeriod(nextPeriod));
  }, [period]);

  return (
    <div className="min-h-[calc(100svh-3rem)] space-y-6 pb-2">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[var(--color-text-primary)]">
            {greeting}, {displayName}
          </h1>
          <p className="mt-2 text-base text-[var(--color-text-secondary)]">
            Here&apos;s what&apos;s happening with your audits today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact className="h-14 w-14" />
          <NotificationBell size="lg" />
        </div>
      </header>

      <div className="flex flex-col gap-4 pt-7 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Audit Overview</h2>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonPill className="w-12 justify-center px-0">
            <Filter className="h-4 w-4" />
          </ButtonPill>
          <DashboardPeriodToggle period={period} onChange={handlePeriodChange} />
          <ButtonPill>
            <Calendar className="h-4 w-4" />
            {shortDate}
          </ButtonPill>
        </div>
      </div>

      <div
        className={cn(
          'space-y-6 transition-opacity duration-300 ease-out',
          refreshing ? 'pointer-events-none opacity-70' : 'opacity-100'
        )}
      >
      <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        {kpiItems.map((item) => (
          <KpiCard key={item.key} item={item} loading={showWidgetsSkeleton} />
        ))}
      </section>

      <Panel className={cn('px-6 py-5', !showWidgetsSkeleton && 'grid gap-0 md:grid-cols-4')}>
        {showWidgetsSkeleton ? (
          <SummaryStripSkeleton columns={summaryItems.length || 4} />
        ) : (
          summaryItems.map((item, index) => (
            <div
              key={item.label}
              className={cn('px-8 py-2', index ? 'border-t border-[var(--color-border-soft)] md:border-l md:border-t-0' : '')}
            >
              <p className="text-sm text-[var(--color-text-secondary)]">{item.label}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4">
                <p className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {item.value}
                </p>
                {item.badge ? (
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                    {item.badge}
                  </span>
                ) : (
                  <span className={cn('text-sm', trendToneClass(item.trend?.tone))}>
                    {item.trend?.text}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border-soft)] px-6 py-5">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Audit Activity Trend</h3>
          </div>
          <div className="bg-[var(--color-surface-elevated)] px-3 py-4 sm:px-5">
            <AuditActivityTrendChart data={auditTrend} loading={showTrendSkeleton} />
          </div>
        </Panel>

        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[var(--color-border-soft)] px-6 py-5">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Issues by Category</h3>
          </div>
          <div className="bg-[var(--color-surface-elevated)] px-3 py-4 sm:px-5">
            <IssuesByCategoryPanel
              categories={issueCategoryItems}
              totalIssues={totalIssuesCount}
              loading={showIssuesSkeleton}
            />
          </div>
        </Panel>
      </section>

      <section>
        <Panel className="overflow-hidden p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Recent Audit Uploads</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-soft)] text-xs font-medium text-[var(--color-text-muted)]">
                  <th className="pb-3">File Name</th>
                  <th className="pb-3">Audit Type</th>
                  <th className="pb-3">Records</th>
                  <th className="pb-3">Uploaded On</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {showRecentSkeleton ? (
                  Array.from({ length: RECENT_AUDITS_PAGE_SIZE }).map((_, index) => (
                    <TableRowSkeleton key={index} columns={5} />
                  ))
                ) : recentAudits.length ? (
                  recentAudits.map((row) => {
                    const statusMeta = getAuditStatusMeta(row.status);

                    return (
                      <tr key={row.auditId} className="border-b border-[var(--color-border-soft)] last:border-0">
                        <td className="py-3 text-[var(--color-text-secondary)]">
                          <span className="inline-flex items-center gap-3">
                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span className="truncate">{row.fileName}</span>
                          </span>
                        </td>
                        <td className="py-3 text-[var(--color-text-secondary)]">{row.auditType}</td>
                        <td className="py-3 text-[var(--color-text-secondary)]">{formatNumber(row.records)}</td>
                        <td className="py-3 text-[var(--color-text-secondary)]">{formatUploadDateTime(row.uploadedOn)}</td>
                        <td className="py-3 text-right text-sm font-medium text-[var(--color-text-primary)]">
                          {statusMeta.label}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                      No recent audit uploads found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
      </div>
    </div>
  );
}

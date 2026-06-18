import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { ChartSkeleton, SummaryStripSkeleton, TableRowSkeleton } from '../components/ui/ChartSkeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useCurrentDateTime } from '../utils/dateTime';
import { getStoredUser } from '../utils/authUser';
import { fetchDashboardWidgets, fetchDashboardAuditTrend, fetchDashboardIssuesCategory, fetchDashboardRecentAudits, getDashboardWidgetsErrorMessage, getDashboardAuditTrendErrorMessage, getDashboardIssuesCategoryErrorMessage, getDashboardRecentAuditsErrorMessage } from '../services/dashboardService';
import { AuditActivityTrendChart } from '../components/charts/AuditActivityTrendChart';
import { IssuesByCategoryPanel } from '../components/charts/IssuesByCategoryPanel';
import { IssuesByCategoryBarChart } from '../components/charts/IssuesByCategoryBarChart';
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

const TREND_PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

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
  const [trendPeriod, setTrendPeriod] = useState(() => {
    const saved = loadAuditSession(DASHBOARD_UI_KEY);
    return saved?.data?.trendPeriod ?? 'daily';
  });
  const [widgets, setWidgets] = useState(null);
  const [auditTrend, setAuditTrend] = useState(null);
  const [issuesCategory, setIssuesCategory] = useState(null);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [issuesCategoryLoading, setIssuesCategoryLoading] = useState(true);
  const [recentAudits, setRecentAudits] = useState([]);
  const [recentAuditsLoading, setRecentAuditsLoading] = useState(true);
  const loadWidgets = useCallback(async (selectedPeriod) => {
    setWidgetsLoading(true);
    try {
      const data = await fetchDashboardWidgets(selectedPeriod);
      setWidgets(data);
    } catch (error) {
      setWidgets(null);
      toast.error(getDashboardWidgetsErrorMessage(error));
    } finally {
      setWidgetsLoading(false);
    }
  }, []);

  const loadAuditTrend = useCallback(async (selectedPeriod) => {
    setTrendLoading(true);
    try {
      const data = await fetchDashboardAuditTrend(selectedPeriod);
      setAuditTrend(data);
    } catch (error) {
      setAuditTrend(null);
      toast.error(getDashboardAuditTrendErrorMessage(error));
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const loadIssuesCategory = useCallback(async (selectedPeriod) => {
    setIssuesCategoryLoading(true);
    try {
      const data = await fetchDashboardIssuesCategory(selectedPeriod);
      setIssuesCategory(data);
    } catch (error) {
      setIssuesCategory(null);
      toast.error(getDashboardIssuesCategoryErrorMessage(error));
    } finally {
      setIssuesCategoryLoading(false);
    }
  }, []);

  const loadRecentAudits = useCallback(async () => {
    setRecentAuditsLoading(true);
    try {
      const { items } = await fetchDashboardRecentAudits({
        page: 1,
        limit: RECENT_AUDITS_PAGE_SIZE,
      });
      setRecentAudits(items);
    } catch (error) {
      setRecentAudits([]);
      toast.error(getDashboardRecentAuditsErrorMessage(error));
    } finally {
      setRecentAuditsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWidgets(period);
    loadIssuesCategory(period);
  }, [period, loadWidgets, loadIssuesCategory]);

  useEffect(() => {
    loadAuditTrend(trendPeriod);
  }, [trendPeriod, loadAuditTrend]);

  useEffect(() => {
    loadRecentAudits();
  }, [loadRecentAudits]);

  const refreshDashboard = useCallback(() => {
    loadWidgets(period);
    loadIssuesCategory(period);
    loadAuditTrend(trendPeriod);
    loadRecentAudits();
  }, [period, trendPeriod, loadWidgets, loadIssuesCategory, loadAuditTrend, loadRecentAudits]);

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
    saveAuditSession(DASHBOARD_UI_KEY, { period, trendPeriod });
  }, [period, trendPeriod]);

  const kpiItems = useMemo(() => buildDashboardKpiItems(widgets), [widgets]);
  const summaryItems = useMemo(() => buildSummaryStripItems(widgets), [widgets]);
  const issueCategoryItems = useMemo(() => buildIssueCategoryItems(issuesCategory), [issuesCategory]);
  const totalIssuesCount = issuesCategory?.totalIssues ?? widgets?.totalIssues?.value ?? 0;

  const periodSelectOptions = useMemo(
    () => DASHBOARD_PERIOD_OPTIONS.map((option) => ({ value: option.id, label: option.label })),
    []
  );

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
          <CustomSelect
            value={period}
            onChange={setPeriod}
            options={periodSelectOptions}
            className="w-[7.5rem]"
            triggerClassName="h-12 px-5"
          />
          <ButtonPill>
            <Calendar className="h-4 w-4" />
            {shortDate}
          </ButtonPill>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-4">
        {kpiItems.map((item) => (
          <KpiCard key={item.key} item={item} loading={widgetsLoading} />
        ))}
      </section>

      <Panel className={cn('px-6 py-5', !widgetsLoading && 'grid gap-0 md:grid-cols-4')}>
        {widgetsLoading ? (
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
          <div className="flex flex-col gap-4 border-b border-[var(--color-border-soft)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Audit Activity Trend</h3>
            <CustomSelect
              value={trendPeriod}
              onChange={setTrendPeriod}
              options={TREND_PERIOD_OPTIONS}
              className="w-[8.5rem]"
              triggerClassName="h-11 px-4"
            />
          </div>
          <div className="bg-[var(--color-surface-elevated)] px-3 py-4 sm:px-5">
            <AuditActivityTrendChart data={auditTrend} loading={trendLoading} />
          </div>
        </Panel>

        <Panel className="p-5">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Issues by Category</h3>
          <IssuesByCategoryPanel
            categories={issueCategoryItems}
            totalIssues={totalIssuesCount}
            loading={issuesCategoryLoading}
          />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
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
                {recentAuditsLoading ? (
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
                        <td className="py-3 text-right">
                          <span className={cn('rounded-md px-2 py-1 text-xs font-medium', statusMeta.className)}>
                            {statusMeta.label}
                          </span>
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

        <Panel className="overflow-hidden p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Issue Breakdown</h3>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Top categories by issue count</p>
            </div>
          </div>
          <IssuesByCategoryBarChart categories={issueCategoryItems} loading={issuesCategoryLoading} />
        </Panel>
      </section>
    </div>
  );
}

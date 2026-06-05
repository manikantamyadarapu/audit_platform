import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar,
  ChevronDown,
  FileSpreadsheet,
  Filter,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Skeleton } from '../components/ui/Skeleton';
import { CustomSelect } from '../components/ui/CustomSelect';
import { useCurrentDateTime } from '../utils/dateTime';
import { getStoredUser } from '../utils/authUser';
import { fetchDashboardWidgets, fetchDashboardAuditTrend, fetchDashboardIssuesCategory, getDashboardWidgetsErrorMessage, getDashboardAuditTrendErrorMessage, getDashboardIssuesCategoryErrorMessage } from '../services/dashboardService';
import { AuditActivityTrendChart } from '../components/charts/AuditActivityTrendChart';
import {
  buildDashboardKpiItems,
  buildSummaryStripItems,
  DASHBOARD_PERIOD_OPTIONS,
} from '../utils/dashboardWidgets';
import { buildIssueCategoryItems } from '../utils/dashboardIssueCategories';
import { formatNumber } from '../utils/format';

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

const uploads = [
  ['Gold_City_2024-12-16.xlsx', 'PAN Audit', '12,458', '16 Dec 2024, 10:30 AM', 'Completed'],
  ['Silver_Palace_2024-12-16.xlsx', 'Gross Weight Audit', '8,965', '16 Dec 2024, 09:15 AM', 'Completed'],
  ['Veena_Jewellers_2024-12-15.xlsx', 'Sales Audit', '9,875', '15 Dec 2024, 08:45 PM', 'Completed'],
  ['Ramesh_Ornaments_2024-12-15.xlsx', 'Inventory Audit', '7,264', '15 Dec 2024, 06:20 PM', 'In Progress'],
  ['Vijay_Store_2024-12-15.xlsx', 'PAN Audit', '10,125', '15 Dec 2024, 04:10 PM', 'Completed'],
];

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
          <Icon className="h-7 w-7" strokeWidth={1.8} />
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

function DonutChart({ categories, totalIssues, loading }) {
  if (loading) {
    return (
      <div className="relative flex h-[230px] w-[230px] shrink-0 items-center justify-center">
        <Skeleton className="h-[230px] w-[230px] rounded-full" />
      </div>
    );
  }

  if (!categories.length) {
    return (
      <div className="flex h-[230px] w-[230px] shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--color-border-soft)] text-center text-sm text-[var(--color-text-muted)]">
        No issue data
      </div>
    );
  }

  const total = categories.reduce((sum, item) => sum + item.value, 0) || totalIssues || 1;
  const gradient = `conic-gradient(${categories
    .map((item, index) => {
      const previous = categories.slice(0, index).reduce((sum, current) => sum + current.value, 0);
      const start = (previous / total) * 100;
      const end = ((previous + item.value) / total) * 100;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(', ')})`;

  return (
    <div className="relative h-[230px] w-[230px] shrink-0 rounded-full" style={{ background: gradient }}>
      <div className="absolute inset-[34px] rounded-full bg-[var(--color-surface-elevated)]" />
      <div className="absolute inset-0 flex items-center justify-center text-center">
        <div>
          <p className="text-3xl font-semibold text-[var(--color-text-primary)]">{formatNumber(totalIssues)}</p>
          <p className="text-sm text-[var(--color-text-muted)]">Total Issues</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { greeting, shortDate } = useCurrentDateTime();
  const storedUser = getStoredUser();
  const displayName = storedUser?.name?.split(/\s+/)[0] || 'Admin';

  const [period, setPeriod] = useState('week');
  const [trendPeriod, setTrendPeriod] = useState('daily');
  const [widgets, setWidgets] = useState(null);
  const [auditTrend, setAuditTrend] = useState(null);
  const [issuesCategory, setIssuesCategory] = useState(null);
  const [widgetsLoading, setWidgetsLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);
  const [issuesCategoryLoading, setIssuesCategoryLoading] = useState(true);
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

  useEffect(() => {
    loadWidgets(period);
    loadIssuesCategory(period);
  }, [period, loadWidgets, loadIssuesCategory]);

  useEffect(() => {
    loadAuditTrend(trendPeriod);
  }, [trendPeriod, loadAuditTrend]);

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
          <p className="mt-2 text-base text-[var(--color-text-secondary)]">Here's what's happening with your audits today.</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact className="h-14 w-14" />
          <button
            type="button"
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-medium text-white">
              3
            </span>
          </button>
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

      <Panel className="grid gap-0 px-6 py-5 md:grid-cols-4">
        {summaryItems.map((item, index) => (
          <div
            key={item.label}
            className={cn('px-8 py-2', index ? 'border-t border-[var(--color-border-soft)] md:border-l md:border-t-0' : '')}
          >
            <p className="text-sm text-[var(--color-text-secondary)]">{item.label}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <p className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                {widgetsLoading ? '—' : item.value}
              </p>
              {item.badge ? (
                <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {item.badge}
                </span>
              ) : (
                <span className={cn('text-sm', trendToneClass(item.trend?.tone))}>
                  {widgetsLoading ? '…' : item.trend?.text}
                </span>
              )}
            </div>
          </div>
        ))}
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
          <div className="mt-4 flex flex-col items-center gap-4 lg:flex-row">
            <DonutChart
              categories={issueCategoryItems}
              totalIssues={totalIssuesCount}
              loading={issuesCategoryLoading}
            />
            <div className="w-full flex-1 space-y-5">
              {issuesCategoryLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <Skeleton className="h-4 w-40 rounded-md" />
                    <Skeleton className="h-4 w-20 rounded-md" />
                  </div>
                ))
              ) : issueCategoryItems.length ? (
                issueCategoryItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                      <i className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      {item.name}
                    </span>
                    <span className="text-[var(--color-text-secondary)]">
                      {formatNumber(item.value)} ({item.percent})
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No issue data for this period.</p>
              )}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Panel className="overflow-hidden p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-950">Recent Audit Uploads</h3>
            <ButtonPill>View All</ButtonPill>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-500">
                  <th className="pb-3">File Name</th>
                  <th className="pb-3">Audit Type</th>
                  <th className="pb-3">Records</th>
                  <th className="pb-3">Uploaded On</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((row) => (
                  <tr key={row[0]} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 text-slate-700">
                      <span className="inline-flex items-center gap-3">
                        <FileSpreadsheet className="h-4 w-4 text-green-600" />
                        {row[0]}
                      </span>
                    </td>
                    <td className="py-3 text-slate-700">{row[1]}</td>
                    <td className="py-3 text-slate-700">{row[2]}</td>
                    <td className="py-3 text-slate-700">{row[3]}</td>
                    <td className="py-3 text-right">
                      <span className={`rounded-md px-2 py-1 text-xs font-medium ${row[4] === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row[4]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-950">Top Issue Summary</h3>
            <ButtonPill>View All</ButtonPill>
          </div>
          <div className="space-y-6">
            {issuesCategoryLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full rounded-lg" />
              ))
            ) : issueCategoryItems.length ? (
              issueCategoryItems.map((item) => (
                <div key={item.name} className="grid grid-cols-[1fr_auto_130px] items-center gap-4 text-sm">
                  <span className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                    <i className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${item.color}33` }}>
                      <ShieldCheck className="h-4 w-4" style={{ color: item.color }} />
                    </i>
                    {item.name}
                  </span>
                  <span className="text-[var(--color-text-secondary)]">
                    {formatNumber(item.value)} ({item.percent})
                  </span>
                  <span className="h-2 rounded-full bg-[var(--color-surface-subtle)]">
                    <i
                      className="block h-2 rounded-full"
                      style={{ width: item.percent, backgroundColor: item.color }}
                    />
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No issue data for this period.</p>
            )}
          </div>
        </Panel>
      </section>
    </div>
  );
}

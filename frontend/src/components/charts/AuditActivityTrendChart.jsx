import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { ChartSkeleton } from '../ui/ChartSkeleton';
import { useAppUi } from '../../context/AppUiContext';
import { formatNumber } from '../../utils/format';

/**
 * @param {import('../../types/dashboard').DashboardAuditTrendData} chartPayload
 * @param {boolean} isDark
 */
function buildChartOptions(chartPayload, isDark) {
  const legendColor = isDark ? '#cbd5e1' : '#475569';
  const gridColor = isDark ? '#334155' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';

  return {
    chart: {
      type: 'area',
      height: 320,
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
      fontFamily: 'Poppins, sans-serif',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 700,
      },
    },
    theme: {
      mode: isDark ? 'dark' : 'light',
    },
    colors: ['#38bdf8', '#fb923c'],
    series: [
      { name: 'Audits Processed', data: chartPayload.auditsProcessed },
      { name: 'Issues Found', data: chartPayload.issuesFound },
    ],
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: isDark ? 0.45 : 0.35,
        opacityTo: 0.05,
        stops: [0, 90, 100],
      },
    },
    dataLabels: { enabled: false },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'center',
      fontSize: '13px',
      fontWeight: 500,
      labels: { colors: legendColor },
      markers: {
        size: 6,
        strokeWidth: 0,
        offsetX: -4,
      },
      itemMargin: {
        horizontal: 16,
        vertical: 0,
      },
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      padding: { left: 8, right: 8 },
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      categories: chartPayload.labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: axisColor,
          fontSize: '12px',
          fontWeight: 500,
        },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: axisColor,
          fontSize: '12px',
          fontWeight: 500,
        },
        formatter: (value) => {
          if (value >= 1000) return `${Math.round(value / 100) / 10}K`;
          return String(Math.round(value));
        },
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      shared: true,
      intersect: false,
      custom({ dataPointIndex }) {
        const label = chartPayload.labels[dataPointIndex] ?? '';
        const audits = chartPayload.auditsProcessed[dataPointIndex] ?? 0;
        const issues = chartPayload.issuesFound[dataPointIndex] ?? 0;

        if (isDark) {
          return `
            <div class="px-3 py-2.5 text-sm">
              <div class="mb-2 font-semibold text-slate-100">${label}</div>
              <div class="flex items-center gap-2 text-slate-300">
                <span class="inline-block h-2.5 w-2.5 rounded-full bg-sky-400"></span>
                Audits Processed: <strong class="text-white">${formatNumber(audits)}</strong>
              </div>
              <div class="mt-1 flex items-center gap-2 text-slate-300">
                <span class="inline-block h-2.5 w-2.5 rounded-full bg-orange-400"></span>
                Issues Found: <strong class="text-white">${formatNumber(issues)}</strong>
              </div>
            </div>
          `;
        }

        return `
          <div class="px-3 py-2.5 text-sm">
            <div class="mb-2 font-semibold text-slate-900">${label}</div>
            <div class="flex items-center gap-2 text-slate-600">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-sky-500"></span>
              Audits Processed: <strong class="text-slate-900">${formatNumber(audits)}</strong>
            </div>
            <div class="mt-1 flex items-center gap-2 text-slate-600">
              <span class="inline-block h-2.5 w-2.5 rounded-full bg-orange-500"></span>
              Issues Found: <strong class="text-slate-900">${formatNumber(issues)}</strong>
            </div>
          </div>
        `;
      },
    },
    markers: {
      size: 0,
      hover: { size: 6, sizeOffset: 2 },
    },
  };
}

function destroyChart(instanceRef) {
  if (instanceRef.current) {
    instanceRef.current.destroy();
    instanceRef.current = null;
  }
}

/**
 * @param {{ data: import('../../types/dashboard').DashboardAuditTrendData | null, loading?: boolean }} props
 */
export function AuditActivityTrendChart({ data, loading = false }) {
  const { theme } = useAppUi();
  const isDark = theme === 'dark';
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  const chartPayload = useMemo(() => {
    if (!data?.labels?.length) {
      return null;
    }

    return {
      labels: data.labels,
      auditsProcessed: data.auditsProcessed ?? [],
      issuesFound: data.issuesFound ?? [],
    };
  }, [data]);

  useEffect(() => () => destroyChart(instanceRef), []);

  useLayoutEffect(() => {
    if (loading || !chartPayload) {
      destroyChart(instanceRef);
      return undefined;
    }

    const node = chartRef.current;
    if (!node) {
      return undefined;
    }

    const options = buildChartOptions(chartPayload, isDark);

    if (instanceRef.current) {
      void instanceRef.current.updateOptions(options, true, true);
      return undefined;
    }

    instanceRef.current = new ApexCharts(node, options);
    void instanceRef.current.render();

    return () => destroyChart(instanceRef);
  }, [chartPayload, loading, isDark]);

  if (loading) {
    return <ChartSkeleton height={320} variant="area" aria-label="Loading audit activity chart" />;
  }

  if (!chartPayload) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-sm text-[var(--color-text-muted)]">
        No audit trend data available for this period.
      </div>
    );
  }

  return <div ref={chartRef} className="w-full min-h-[320px]" role="img" aria-label="Audit activity trend chart" />;
}

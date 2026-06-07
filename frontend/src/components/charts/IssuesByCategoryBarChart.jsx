import { useEffect, useMemo, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { ChartSkeleton } from '../ui/ChartSkeleton';
import { useAppUi } from '../../context/AppUiContext';
import { formatNumber } from '../../utils/format';

/**
 * @param {Array<{ name: string, value: number, percent: string, color: string }>} categories
 * @param {boolean} isDark
 */
function buildChartOptions(categories, isDark) {
  const colors = categories.map((item) => item.color);
  const legendColor = isDark ? '#cbd5e1' : '#475569';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.25)';

  return {
    chart: {
      type: 'bar',
      height: 320,
      stacked: true,
      stackType: '100%',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Poppins, sans-serif',
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 900,
        animateGradually: {
          enabled: true,
          delay: 140,
        },
        dynamicAnimation: {
          enabled: true,
          speed: 650,
        },
      },
    },
    theme: {
      mode: isDark ? 'dark' : 'light',
    },
    colors,
    series: categories.map((item) => ({
      name: item.name,
      data: [item.value],
    })),
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 10,
        borderRadiusWhenStacked: 'all',
        barHeight: '46%',
        dataLabels: {
          position: 'center',
        },
      },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: isDark ? 'dark' : 'light',
        type: 'horizontal',
        shadeIntensity: 0.35,
        opacityFrom: isDark ? 0.95 : 0.9,
        opacityTo: isDark ? 0.45 : 0.4,
        stops: [0, 60, 100],
      },
    },
    stroke: {
      show: true,
      width: 1,
      colors: [isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)'],
    },
    dataLabels: { enabled: false },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '11px',
      fontWeight: 500,
      labels: { colors: legendColor },
      markers: {
        size: 6,
        strokeWidth: 0,
        offsetX: -3,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 4,
      },
    },
    grid: {
      borderColor: gridColor,
      strokeDashArray: 4,
      padding: { left: 8, right: 12, top: 0, bottom: 0 },
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: false } },
    },
    xaxis: {
      categories: ['Issue mix'],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { show: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: axisColor,
          fontSize: '12px',
          fontWeight: 600,
        },
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      shared: false,
      intersect: true,
      custom({ seriesIndex }) {
        const item = categories[seriesIndex];
        if (!item) return '';

        return `
          <div class="rounded-xl border border-white/20 bg-white/90 px-3 py-2.5 text-sm shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-slate-900/90">
            <div class="mb-1 font-semibold text-slate-900 dark:text-slate-100">${item.name}</div>
            <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <span class="inline-block h-2.5 w-2.5 rounded-full" style="background:${item.color}"></span>
              Issues: <strong class="text-slate-900 dark:text-white">${formatNumber(item.value)}</strong>
              <span class="text-slate-400">(${item.percent})</span>
            </div>
          </div>
        `;
      },
    },
  };
}

/**
 * @param {{
 *   categories: Array<{ name: string, code?: string, value: number, percent: string, color: string }>,
 *   loading?: boolean,
 * }} props
 */
export function IssuesByCategoryBarChart({ categories = [], loading = false }) {
  const { theme } = useAppUi();
  const isDark = theme === 'dark';
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  const chartCategories = useMemo(() => {
    if (!categories.length) return null;
    return categories.slice(0, 8);
  }, [categories]);

  const chartKey = useMemo(
    () => chartCategories?.map((item) => `${item.code}:${item.value}`).join('|') ?? '',
    [chartCategories]
  );

  useEffect(() => {
    if (!chartRef.current || loading || !chartCategories?.length) {
      return undefined;
    }

    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    const options = buildChartOptions(chartCategories, isDark);
    instanceRef.current = new ApexCharts(chartRef.current, options);
    instanceRef.current.render();

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [chartCategories, chartKey, loading, isDark]);

  if (loading) {
    return <ChartSkeleton height={320} variant="bar" aria-label="Loading issue breakdown chart" />;
  }

  if (!chartCategories?.length) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-2xl border border-dashed border-[var(--color-border-soft)] bg-white/20 text-sm text-[var(--color-text-muted)] backdrop-blur-sm dark:bg-slate-900/20">
        No issue data for this period.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/40 bg-gradient-to-br from-white/50 via-white/20 to-emerald-50/30 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),var(--shadow-glass)] backdrop-blur-xl dark:border-white/10 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-emerald-950/20 sm:p-4">
      <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/10" />
      <div
        ref={chartRef}
        className="relative z-[1] w-full"
        role="img"
        aria-label="Issues stacked bar chart"
      />
    </div>
  );
}

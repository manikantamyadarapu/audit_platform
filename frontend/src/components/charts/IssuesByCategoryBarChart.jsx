import { useEffect, useMemo, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { ChartSkeleton } from '../ui/ChartSkeleton';
import { useAppUi } from '../../context/AppUiContext';
import { formatNumber } from '../../utils/format';

/** Chart axis/tooltip tokens aligned with app theme. */
const CHART_THEME = {
  dark: {
    axis: '#cbd5e1',
    axisMuted: '#94a3b8',
    grid: 'rgba(148, 163, 184, 0.22)',
    tooltipBg: '#111827',
    tooltipBorder: 'rgba(71, 85, 105, 0.86)',
    tooltipText: '#f8fafc',
    tooltipMuted: '#94a3b8',
  },
  light: {
    axis: '#334155',
    axisMuted: '#64748b',
    grid: 'rgba(148, 163, 184, 0.38)',
    tooltipBg: '#ffffff',
    tooltipBorder: 'rgba(226, 232, 240, 0.86)',
    tooltipText: '#020617',
    tooltipMuted: '#64748b',
  },
};

/**
 * @param {Array<{ name: string, value: number, percent: string, color: string }>} categories
 * @param {boolean} isDark
 */
function buildChartOptions(categories, isDark) {
  const theme = isDark ? CHART_THEME.dark : CHART_THEME.light;
  const labels = categories.map((item) => item.name);
  const values = categories.map((item) => item.value);
  const barColors = categories.map((item) => item.color);

  return {
    chart: {
      type: 'bar',
      height: 320,
      toolbar: { show: false },
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
    colors: barColors,
    series: [
      {
        name: 'Issues',
        data: values,
      },
    ],
    plotOptions: {
      bar: {
        horizontal: false,
        distributed: true,
        columnWidth: '48%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
        dataLabels: { position: 'top' },
      },
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: isDark ? 'dark' : 'light',
        type: 'vertical',
        shadeIntensity: 0.4,
        opacityFrom: 0.95,
        opacityTo: 0.72,
        stops: [0, 100],
      },
    },
    states: {
      hover: {
        filter: { type: 'darken', value: 0.08 },
      },
      active: {
        filter: { type: 'none' },
      },
    },
    dataLabels: { enabled: false },
    legend: { show: false },
    grid: {
      show: true,
      borderColor: theme.grid,
      strokeDashArray: 4,
      position: 'back',
      padding: { left: 12, right: 16, top: 8, bottom: 0 },
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      categories: labels,
      axisBorder: {
        show: true,
        color: theme.grid,
        height: 1,
      },
      axisTicks: {
        show: true,
        color: theme.axis,
        height: 6,
      },
      labels: {
        rotate: labels.some((label) => label.length > 12) ? -35 : 0,
        rotateAlways: false,
        hideOverlappingLabels: true,
        trim: true,
        maxHeight: 72,
        style: {
          colors: theme.axis,
          fontSize: '11px',
          fontWeight: 500,
        },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      title: {
        text: 'Issue count',
        rotate: -90,
        offsetX: 0,
        offsetY: 0,
        style: {
          color: theme.axisMuted,
          fontSize: '11px',
          fontWeight: 500,
        },
      },
      labels: {
        style: {
          colors: theme.axisMuted,
          fontSize: '11px',
          fontWeight: 500,
        },
        formatter: (value) => formatNumber(Math.round(value)),
      },
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      shared: false,
      intersect: true,
      custom({ dataPointIndex }) {
        const item = categories[dataPointIndex];
        if (!item) return '';

        return `
          <div style="
            border-radius: 10px;
            border: 1px solid ${theme.tooltipBorder};
            background: ${theme.tooltipBg};
            padding: 10px 12px;
            font-size: 12px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
          ">
            <div style="margin-bottom: 4px; font-weight: 600; color: ${theme.tooltipText};">${item.name}</div>
            <div style="color: ${theme.tooltipMuted};">
              <span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${item.color};margin-right:6px;"></span>
              Issues: <strong style="color: ${theme.tooltipText};">${formatNumber(item.value)}</strong>
              <span style="opacity: 0.75;"> (${item.percent})</span>
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
      <div className="flex h-[320px] w-full items-center justify-center text-sm text-[var(--color-text-muted)]">
        No issue data for this period.
      </div>
    );
  }

  return (
    <div ref={chartRef} className="w-full" role="img" aria-label="Issues by category column chart" />
  );
}

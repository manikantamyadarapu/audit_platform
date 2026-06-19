import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { ChartSkeleton } from '../ui/ChartSkeleton';
import { formatNumber } from '../../utils/format';

const SIZE = 210;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = SIZE / 2;
const INNER_R = OUTER_R - 32;
const MID_R = (OUTER_R + INNER_R) / 2;
const RING_WIDTH = OUTER_R - INNER_R;
const TRACK_CIRCUMFERENCE = 2 * Math.PI * MID_R;

const DONUT_RING_VARIANTS = {
  hidden: { scale: 0.55, opacity: 0, rotate: -120 },
  visible: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: { duration: 0.95, ease: [0.22, 1, 0.36, 1] },
  },
};

const DONUT_SEGMENT_VARIANTS = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (index) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.2 + index * 0.08,
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const DONUT_CENTER_VARIANTS = {
  hidden: { scale: 0.65, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { delay: 0.32, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeDonutSegment(startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    const topOuter = polarToCartesian(CX, CY, OUTER_R, 0);
    const bottomOuter = polarToCartesian(CX, CY, OUTER_R, 180);
    const topInner = polarToCartesian(CX, CY, INNER_R, 0);
    const bottomInner = polarToCartesian(CX, CY, INNER_R, 180);

    return [
      `M ${topOuter.x} ${topOuter.y}`,
      `A ${OUTER_R} ${OUTER_R} 0 1 1 ${bottomOuter.x} ${bottomOuter.y}`,
      `A ${OUTER_R} ${OUTER_R} 0 1 1 ${topOuter.x} ${topOuter.y}`,
      `L ${topInner.x} ${topInner.y}`,
      `A ${INNER_R} ${INNER_R} 0 1 0 ${bottomInner.x} ${bottomInner.y}`,
      `A ${INNER_R} ${INNER_R} 0 1 0 ${topInner.x} ${topInner.y}`,
      'Z',
    ].join(' ');
  }

  const startOuter = polarToCartesian(CX, CY, OUTER_R, endAngle);
  const endOuter = polarToCartesian(CX, CY, OUTER_R, startAngle);
  const startInner = polarToCartesian(CX, CY, INNER_R, startAngle);
  const endInner = polarToCartesian(CX, CY, INNER_R, endAngle);
  const largeArc = sweep <= 180 ? 0 : 1;

  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 0 ${endOuter.x} ${endOuter.y}`,
    `L ${startInner.x} ${startInner.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 1 ${endInner.x} ${endInner.y}`,
    'Z',
  ].join(' ');
}

function buildSegments(categories) {
  const total = categories.reduce((sum, item) => sum + item.value, 0) || 1;
  let cursor = 0;

  return categories.map((item) => {
    const sweep = (item.value / total) * 360;
    const startAngle = cursor;
    const endAngle = cursor + sweep;
    cursor = endAngle;

    return {
      ...item,
      startAngle,
      endAngle,
      path: describeDonutSegment(startAngle, endAngle),
    };
  });
}

/**
 * @param {{
 *   categories: Array<{ name: string, code?: string, value: number, percent: string, color: string }>,
 *   totalIssues: number,
 *   loading?: boolean,
 * }} props
 */
export function IssuesByCategoryPanel({ categories, totalIssues, loading = false }) {
  const [selectedCode, setSelectedCode] = useState(null);
  const [hoveredCode, setHoveredCode] = useState(null);

  useEffect(() => {
    setSelectedCode(null);
    setHoveredCode(null);
  }, [categories]);

  const visibleCategories = useMemo(() => {
    if (!selectedCode) return categories;
    return categories.filter((item) => item.code === selectedCode);
  }, [categories, selectedCode]);

  const segments = useMemo(() => buildSegments(visibleCategories), [visibleCategories]);

  const animationKey = useMemo(
    () => `${categories.map((item) => item.code).join('|')}:${selectedCode ?? 'all'}:${loading ? 'loading' : 'ready'}`,
    [categories, selectedCode, loading]
  );

  const activeItem = useMemo(() => {
    const code = hoveredCode || selectedCode;
    if (!code) return null;
    return categories.find((item) => item.code === code) ?? null;
  }, [categories, hoveredCode, selectedCode]);

  const handleLegendClick = (code) => {
    setSelectedCode((current) => (current === code ? null : code));
    setHoveredCode(null);
  };

  if (loading) {
    return <ChartSkeleton height={320} variant="donut" aria-label="Loading issues by category chart" />;
  }

  if (!categories.length) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">No issue data for this period.</p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-8 lg:gap-10">
      <div className="relative h-[210px] w-[210px] shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full overflow-visible"
          role="img"
          aria-label="Issues by category donut chart"
        >
          <motion.circle
            key={`track-${animationKey}`}
            cx={CX}
            cy={CY}
            r={MID_R}
            fill="none"
            stroke="currentColor"
            strokeWidth={RING_WIDTH}
            strokeLinecap="round"
            className="text-emerald-500/15 dark:text-emerald-400/20"
            initial={{ strokeDashoffset: TRACK_CIRCUMFERENCE, opacity: 0.4 }}
            animate={{ strokeDashoffset: 0, opacity: 1 }}
            transition={{ duration: 1.15, ease: 'easeInOut' }}
            style={{
              strokeDasharray: TRACK_CIRCUMFERENCE,
              transformOrigin: `${CX}px ${CY}px`,
              rotate: -90,
            }}
          />

          <motion.g
            key={animationKey}
            variants={DONUT_RING_VARIANTS}
            initial="hidden"
            animate="visible"
            style={{ transformOrigin: `${CX}px ${CY}px` }}
          >
            {segments.map((segment, index) => {
              const isDimmed = hoveredCode && hoveredCode !== segment.code && !selectedCode;
              const isHighlighted = hoveredCode === segment.code || selectedCode === segment.code;

              return (
                <motion.path
                  key={segment.code || segment.name}
                  d={segment.path}
                  fill={segment.color}
                  custom={index}
                  variants={DONUT_SEGMENT_VARIANTS}
                  initial="hidden"
                  animate="visible"
                  style={{ transformOrigin: `${CX}px ${CY}px` }}
                  className={cn(
                    'cursor-pointer transition-opacity duration-200',
                    isDimmed && 'opacity-35',
                    isHighlighted && 'opacity-100'
                  )}
                  onMouseEnter={() => setHoveredCode(segment.code || null)}
                  onMouseLeave={() => setHoveredCode(null)}
                  onClick={() => handleLegendClick(segment.code)}
                />
              );
            })}
          </motion.g>
        </svg>

        <motion.div
          key={`center-${animationKey}`}
          variants={DONUT_CENTER_VARIANTS}
          initial="hidden"
          animate="visible"
          className="pointer-events-none absolute inset-[32px] flex items-center justify-center rounded-full bg-[var(--color-surface-elevated)] text-center shadow-[inset_0_0_0_1px_var(--color-border-soft)]"
        >
          <div className="px-2">
            <p
              className={cn(
                'text-xs font-medium',
                activeItem ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'
              )}
              style={activeItem ? { color: activeItem.color } : undefined}
            >
              {activeItem ? activeItem.name : 'Total Issues'}
            </p>
            <p
              className="mt-0.5 text-[1.75rem] font-bold leading-none tracking-tight"
              style={{ color: activeItem ? activeItem.color : 'var(--color-text-primary)' }}
            >
              {formatNumber(activeItem ? activeItem.value : totalIssues)}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="w-full min-w-0 flex-1">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-2.5">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Category</span>
          <span className="text-xs font-medium text-[var(--color-text-muted)]">Count %</span>
        </div>

        <div className="divide-y divide-[var(--color-border-soft)]">
          {categories.map((item) => {
            const isSelected = selectedCode === item.code;

            return (
              <button
                key={item.code || item.name}
                type="button"
                onClick={() => handleLegendClick(item.code)}
                className={cn(
                  'flex w-full items-center justify-between gap-4 py-2.5 text-left',
                  isSelected && 'bg-[var(--color-surface-subtle)]/60'
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <i
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className={cn(
                      'truncate text-sm font-medium text-[var(--color-text-primary)]',
                      isSelected && 'font-semibold'
                    )}
                    style={isSelected ? { color: item.color } : undefined}
                  >
                    {item.name}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-3">
                  <span
                    className="inline-flex min-w-[2.25rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-semibold"
                    style={{
                      backgroundColor: `${item.color}20`,
                      color: item.color,
                    }}
                  >
                    {formatNumber(item.value)}
                  </span>
                  <span className="w-12 text-right text-sm font-medium text-[var(--color-text-muted)]">
                    {item.percent}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {selectedCode ? (
          <button
            type="button"
            onClick={() => setSelectedCode(null)}
            className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Show all categories
          </button>
        ) : null}
      </div>
    </div>
  );
}

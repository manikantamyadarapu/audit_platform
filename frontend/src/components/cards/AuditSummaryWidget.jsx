import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { formatIndianNumber } from '../../utils/format';
import {
  isPercentMetric,
  parseMetricNumber,
  useAnimatedNumber,
} from '../../hooks/useAnimatedNumber';

const accentStyles = {
  blue: {
    icon: 'text-sky-600 dark:text-sky-300',
    iconWrap:
      'bg-sky-500/10 ring-sky-500/15 dark:bg-sky-400/10 dark:ring-sky-400/20',
    glow: 'radial-gradient(circle, rgba(186,230,253,0.55) 0%, transparent 70%)',
    selectedRing: 'ring-sky-400/35',
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-300',
    iconWrap:
      'bg-emerald-500/10 ring-emerald-500/15 dark:bg-emerald-400/10 dark:ring-emerald-400/20',
    glow: 'radial-gradient(circle, rgba(167,243,208,0.55) 0%, transparent 70%)',
    selectedRing: 'ring-emerald-400/35',
  },
  violet: {
    icon: 'text-violet-600 dark:text-violet-300',
    iconWrap:
      'bg-violet-500/10 ring-violet-500/15 dark:bg-violet-400/10 dark:ring-violet-400/20',
    glow: 'radial-gradient(circle, rgba(221,214,254,0.55) 0%, transparent 70%)',
    selectedRing: 'ring-violet-400/35',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-300',
    iconWrap:
      'bg-amber-500/10 ring-amber-500/15 dark:bg-amber-400/10 dark:ring-amber-400/20',
    glow: 'radial-gradient(circle, rgba(253,230,138,0.55) 0%, transparent 70%)',
    selectedRing: 'ring-amber-400/35',
  },
  rose: {
    icon: 'text-rose-600 dark:text-rose-300',
    iconWrap:
      'bg-rose-500/10 ring-rose-500/15 dark:bg-rose-400/10 dark:ring-rose-400/20',
    glow: 'radial-gradient(circle, rgba(254,205,211,0.55) 0%, transparent 70%)',
    selectedRing: 'ring-rose-400/35',
  },
  orange: {
    icon: 'text-orange-600 dark:text-orange-300',
    iconWrap:
      'bg-orange-500/10 ring-orange-500/15 dark:bg-orange-400/10 dark:ring-orange-400/20',
    glow: 'radial-gradient(circle, rgba(254,215,170,0.55) 0%, transparent 70%)',
    selectedRing: 'ring-orange-400/35',
  },
};

function formatAnimatedValue(rawValue, animated, isPercent) {
  if (rawValue == null || rawValue === '—' || rawValue === 'View') return rawValue;
  if (animated == null) return rawValue;
  if (isPercent) return `${animated.toFixed(1)}%`;
  const hasFraction = String(rawValue).includes('.');
  return formatIndianNumber(animated, {
    minDecimals: hasFraction ? 1 : 0,
    maxDecimals: hasFraction ? 4 : 0,
  });
}

/**
 * Audit intelligence KPI widget — compact white card.
 */
export function AuditSummaryWidget({
  icon: Icon,
  label,
  value,
  accent = 'blue',
  delay = 0,
  interactive = false,
  selected = false,
  onClick,
}) {
  const styles = accentStyles[accent] || accentStyles.blue;

  const numericValue = parseMetricNumber(value);
  const isPercent = isPercentMetric(value);
  const animated = useAnimatedNumber(numericValue, { enabled: numericValue != null });
  const displayValue = formatAnimatedValue(value, animated, isPercent);

  const handleKeyDown = (e) => {
    if (!interactive || !onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        interactive ? { y: -2, transition: { duration: 0.16, ease: 'easeOut' } } : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? selected : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-xl bg-white dark:bg-slate-900/90',
        'shadow-[0_1px_8px_rgba(15,23,42,0.05)]',
        'transition-shadow duration-200',
        interactive &&
          'cursor-pointer select-none hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-page)] focus-visible:ring-sky-400/40',
        selected && cn('ring-2 ring-offset-2 ring-offset-[var(--color-surface-page)]', styles.selectedRing)
      )}
    >
      <div className="relative flex items-start justify-between gap-3 p-3.5">
        {Icon ? (
          <div
            className="pointer-events-none absolute -left-1 -top-1 h-14 w-14 rounded-full opacity-70"
            style={{ background: styles.glow }}
            aria-hidden
          />
        ) : null}

        <div className="relative min-w-0 flex-1">
          {Icon ? (
            <div
              className={cn(
                'mb-2 flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset',
                styles.iconWrap
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', styles.icon)} strokeWidth={2} />
            </div>
          ) : null}

          <p className="line-clamp-2 text-xs font-semibold uppercase leading-snug tracking-[0.1em] text-[var(--color-text-secondary)]">
            {label}
          </p>

          <p className="mt-1.5 truncate text-2xl font-semibold leading-none tracking-tight text-[var(--color-text-primary)] tabular-nums">
            {displayValue}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

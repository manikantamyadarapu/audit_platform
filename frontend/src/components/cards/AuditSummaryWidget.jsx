import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';
import { cn } from '../../utils/cn';
import {
  isPercentMetric,
  parseMetricNumber,
  useAnimatedNumber,
} from '../../hooks/useAnimatedNumber';

const accentStyles = {
  blue: {
    icon: 'text-sky-600 dark:text-sky-400',
    glow: 'bg-sky-500/10 ring-sky-500/15 dark:bg-sky-400/10 dark:ring-sky-400/20',
    bar: 'from-sky-400 to-sky-600',
    ring: '#0ea5e9',
    badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/20',
    border: 'from-sky-400/25 via-sky-300/8 to-transparent',
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    glow: 'bg-emerald-500/10 ring-emerald-500/15 dark:bg-emerald-400/10 dark:ring-emerald-400/20',
    bar: 'from-emerald-400 to-emerald-600',
    ring: '#10b981',
    badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
    border: 'from-emerald-400/25 via-emerald-300/8 to-transparent',
  },
  violet: {
    icon: 'text-violet-600 dark:text-violet-400',
    glow: 'bg-violet-500/10 ring-violet-500/15 dark:bg-violet-400/10 dark:ring-violet-400/20',
    bar: 'from-violet-400 to-violet-600',
    ring: '#8b5cf6',
    badge: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/20',
    border: 'from-violet-400/25 via-violet-300/8 to-transparent',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    glow: 'bg-amber-500/10 ring-amber-500/15 dark:bg-amber-400/10 dark:ring-amber-400/20',
    bar: 'from-amber-400 to-amber-600',
    ring: '#f59e0b',
    badge: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-500/20',
    border: 'from-amber-400/25 via-amber-300/8 to-transparent',
  },
  rose: {
    icon: 'text-rose-600 dark:text-rose-400',
    glow: 'bg-rose-500/10 ring-rose-500/15 dark:bg-rose-400/10 dark:ring-rose-400/20',
    bar: 'from-rose-400 to-rose-600',
    ring: '#f43f5e',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20',
    border: 'from-rose-400/25 via-rose-300/8 to-transparent',
  },
  orange: {
    icon: 'text-orange-600 dark:text-orange-400',
    glow: 'bg-orange-500/10 ring-orange-500/15 dark:bg-orange-400/10 dark:ring-orange-400/20',
    bar: 'from-orange-400 to-orange-600',
    ring: '#f97316',
    badge: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/20',
    border: 'from-orange-400/25 via-orange-300/8 to-transparent',
  },
};

function inferVariant(label) {
  const text = String(label ?? '').toLowerCase();
  if (text.includes('compliance')) return 'compliance';
  if (text.includes('higher sales return') || text.includes('risk')) return 'risk';
  if (text.includes('error') || text.includes('mismatch') || text.includes('incorrect')) return 'error';
  if (text.includes('deviation') || text.includes('range')) return 'deviation';
  return 'default';
}

function formatAnimatedValue(rawValue, animated, isPercent) {
  if (rawValue == null || rawValue === '—' || rawValue === 'View') return rawValue;
  if (animated == null) return rawValue;
  if (isPercent) return `${animated.toFixed(1)}%`;
  if (String(rawValue).includes('.')) return animated.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return Math.round(animated).toLocaleString();
}

function ComplianceRing({ percent, color, size = 36 }) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(percent, 0), 100) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200/80 dark:text-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[8px] font-bold tabular-nums text-[var(--color-text-primary)]">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

function ProgressBar({ percent, barClass, delay = 0 }) {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/10">
      <motion.div
        className={cn('h-full rounded-full bg-gradient-to-r', barClass)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        transition={{ duration: 0.85, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

function StatusBadge({ children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        className
      )}
    >
      {children}
    </span>
  );
}

/**
 * Premium audit intelligence summary widget — audit pages only.
 */
export function AuditSummaryWidget({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'blue',
  delay = 0,
  interactive = false,
  selected = false,
  onClick,
  variant,
  total,
  badge,
}) {
  const resolvedVariant = variant ?? inferVariant(label);
  const styles = accentStyles[accent] || accentStyles.blue;

  const numericValue = parseMetricNumber(value);
  const isPercent = isPercentMetric(value);
  const animated = useAnimatedNumber(numericValue, { enabled: numericValue != null });
  const displayValue = formatAnimatedValue(value, animated, isPercent);

  const sharePercent =
    total && numericValue != null && total > 0 && !isPercent
      ? (numericValue / total) * 100
      : null;

  const compliancePercent = isPercent ? numericValue : null;
  const showShareBar = sharePercent != null && sharePercent > 0 && resolvedVariant !== 'compliance';

  const handleKeyDown = (e) => {
    if (!interactive || !onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={interactive ? { y: -2, transition: { duration: 0.18 } } : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex min-h-[104px] flex-col overflow-hidden rounded-[18px] p-px',
        interactive && 'cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/45'
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 rounded-[18px] bg-gradient-to-br opacity-70',
          styles.border
        )}
      />
      <div
        className={cn(
          'relative flex h-full flex-1 flex-col rounded-[17px] border border-white/35 bg-white/50 px-3 py-2.5 shadow-[0_4px_20px_rgba(15,23,42,0.05)] backdrop-blur-xl',
          'dark:border-white/8 dark:bg-slate-900/40 dark:shadow-[0_4px_24px_rgba(0,0,0,0.28)]',
          'transition-all duration-200',
          interactive && 'group-hover:border-white/55 group-hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)]',
          selected &&
            'ring-2 ring-violet-400/35 shadow-[0_0_0_1px_rgba(139,92,246,0.12),0_8px_24px_rgba(139,92,246,0.1)]'
        )}
      >
        <div className="flex items-start justify-between gap-1.5">
          <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase leading-snug tracking-[0.1em] text-[var(--color-text-secondary)] sm:text-xs">
            {label}
          </p>
          {Icon ? (
            <div
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1 backdrop-blur-sm',
                styles.glow
              )}
            >
              <Icon className={cn('h-3 w-3', styles.icon)} strokeWidth={1.75} />
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex flex-1 items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold leading-none tracking-tight text-[var(--color-text-primary)] tabular-nums">
              {displayValue}
            </p>

            {hint ? (
              <p className="mt-1 line-clamp-1 text-[10px] text-[var(--color-text-muted)]">{hint}</p>
            ) : null}

            {sharePercent != null ? (
              <p className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
                {sharePercent.toFixed(1)}% of total
              </p>
            ) : null}

            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {resolvedVariant === 'risk' && numericValue != null && numericValue > 0 ? (
                <StatusBadge className={styles.badge}>
                  <ShieldAlert className="h-2 w-2" />
                  {badge ?? 'Risk'}
                </StatusBadge>
              ) : null}
              {resolvedVariant === 'deviation' && numericValue != null && numericValue > 0 ? (
                <StatusBadge className={styles.badge}>
                  <TrendingUp className="h-2 w-2" />
                  {badge ?? 'Deviation'}
                </StatusBadge>
              ) : null}
              {resolvedVariant === 'error' && numericValue != null && numericValue > 0 ? (
                <StatusBadge className={styles.badge}>
                  <AlertTriangle className="h-2 w-2" />
                  {badge ?? 'Review'}
                </StatusBadge>
              ) : null}
              {resolvedVariant === 'compliance' && compliancePercent != null ? (
                <StatusBadge
                  className={cn(
                    compliancePercent >= 80
                      ? accentStyles.emerald.badge
                      : compliancePercent >= 50
                        ? accentStyles.amber.badge
                        : accentStyles.rose.badge
                  )}
                >
                  {compliancePercent >= 80 ? 'Healthy' : compliancePercent >= 50 ? 'Moderate' : 'At risk'}
                </StatusBadge>
              ) : null}
            </div>
          </div>

          {resolvedVariant === 'compliance' && compliancePercent != null ? (
            <ComplianceRing percent={compliancePercent ?? 0} color={styles.ring} />
          ) : null}
        </div>

        {showShareBar ? (
          <div className="mt-2">
            <ProgressBar percent={sharePercent} barClass={styles.bar} delay={delay + 0.08} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const accentMap = {
  blue: {
    iconBg:
      'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-400 dark:ring-sky-900/50',
  },
  emerald: {
    iconBg:
      'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-900/50',
  },
  violet: {
    iconBg:
      'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-400 dark:ring-violet-900/50',
  },
  amber: {
    iconBg:
      'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900/50',
  },
  rose: {
    iconBg:
      'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/50',
  },
  orange: {
    iconBg:
      'bg-orange-50 text-orange-600 ring-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:ring-orange-900/50',
  },
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'blue',
  delay = 0,
  interactive = false,
  selected = false,
  onClick,
}) {
  const a = accentMap[accent] || accentMap.blue;

  const handleKeyDown = (e) => {
    if (!interactive || !onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative overflow-hidden rounded-[18px] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-glass)]',
        interactive &&
          'cursor-pointer select-none transition-[box-shadow,opacity] duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40',
        interactive &&
          selected &&
          'ring-2 ring-sky-400/35 shadow-[var(--shadow-glass),0_0_0_1px_rgba(56,189,248,0.12)]',
        interactive && !selected && 'hover:opacity-[0.97]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
            {label}
          </p>
          <p
            className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]"
            style={{
              fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </p>
          {hint ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p> : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ring-1',
              a.iconBg
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

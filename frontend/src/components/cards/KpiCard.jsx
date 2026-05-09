import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const accentMap = {
  blue: {
    iconBg: 'bg-sky-50 text-sky-600 ring-sky-100',
  },
  emerald: {
    iconBg: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  },
  violet: {
    iconBg: 'bg-violet-50 text-violet-600 ring-violet-100',
  },
  amber: {
    iconBg: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
  rose: {
    iconBg: 'bg-rose-50 text-rose-600 ring-rose-100',
  },
  orange: {
    iconBg: 'bg-orange-50 text-orange-600 ring-orange-100',
  },
};

export function KpiCard({ icon: Icon, label, value, hint, accent = 'blue', delay = 0 }) {
  const a = accentMap[accent] || accentMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        'relative overflow-hidden rounded-[18px] border border-slate-200/70 bg-white p-5 shadow-[var(--shadow-glass)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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

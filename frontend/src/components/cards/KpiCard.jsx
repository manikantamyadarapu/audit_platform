import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const accentMap = {
  blue: {
    wash: 'from-blue-500/12 via-white/40 to-indigo-500/8',
    icon: 'text-blue-600',
  },
  emerald: {
    wash: 'from-emerald-500/12 via-white/40 to-teal-500/8',
    icon: 'text-emerald-600',
  },
  violet: {
    wash: 'from-violet-500/12 via-white/40 to-purple-500/8',
    icon: 'text-violet-600',
  },
  amber: {
    wash: 'from-amber-500/15 via-white/40 to-orange-500/8',
    icon: 'text-amber-600',
  },
  rose: {
    wash: 'from-rose-500/12 via-white/40 to-pink-500/8',
    icon: 'text-rose-600',
  },
};

export function KpiCard({ icon: Icon, label, value, hint, accent = 'blue', delay = 0 }) {
  const a = accentMap[accent] || accentMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/70 p-5 backdrop-blur-xl shadow-[var(--shadow-glass)]"
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90',
          a.wash
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/85 shadow-inner shadow-slate-200/50 ring-1 ring-slate-200/60">
            <Icon className={cn('h-5 w-5', a.icon)} strokeWidth={1.75} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

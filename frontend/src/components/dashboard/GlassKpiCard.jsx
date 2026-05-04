import { motion } from 'framer-motion';
import { AlertTriangle, Database, FileSpreadsheet, Fingerprint, Scale, TrendingUp } from 'lucide-react';
import { cn } from '../../utils/cn';

const icons = {
  files: FileSpreadsheet,
  database: Database,
  alert: AlertTriangle,
  scale: Scale,
  id: Fingerprint,
  trending: TrendingUp,
};

const trendColor = {
  up: 'text-emerald-600',
  down: 'text-rose-600',
  neutral: 'text-slate-500',
};

export function GlassKpiCard({ label, value, hint, trend = 'neutral', icon, index = 0 }) {
  const Icon = icons[icon] ?? FileSpreadsheet;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/80 bg-white/55 p-5 shadow-[var(--shadow-glass)] backdrop-blur-xl',
        'transition-transform duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_40px_-12px_rgba(30,64,175,0.12)]'
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-blue-400/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
          {hint ? (
            <p className={cn('mt-1 text-xs font-medium', trendColor[trend] ?? trendColor.neutral)}>{hint}</p>
          ) : null}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-600 ring-1 ring-slate-200/80 transition group-hover:from-blue-50 group-hover:to-indigo-50 group-hover:text-blue-700 group-hover:ring-blue-200/60">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
    </motion.div>
  );
}

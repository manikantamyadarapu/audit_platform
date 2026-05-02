import { motion } from 'framer-motion';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';

export function DepartmentCard({
  title,
  subtitle,
  status,
  progress,
  modules,
  delay = 0,
  muted,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        'rounded-2xl border border-white/70 bg-white/65 p-6 backdrop-blur-xl shadow-[var(--shadow-glass)]',
        muted && 'opacity-75'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <Badge tone={status === 'active' ? 'emerald' : 'slate'}>{status === 'active' ? 'Active' : 'On hold'}</Badge>
      </div>

      {typeof progress === 'number' ? (
        <div className="mt-5">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>Operational readiness</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {modules?.length ? (
        <ul className="mt-5 space-y-2 text-sm text-slate-600">
          {modules.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500/80" />
              {m}
            </li>
          ))}
        </ul>
      ) : null}
    </motion.div>
  );
}

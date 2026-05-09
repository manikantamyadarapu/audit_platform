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
        'rounded-[18px] border border-slate-200/70 bg-white p-6 shadow-[var(--shadow-glass)]',
        muted && 'opacity-80 saturate-75'
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <Badge tone={status === 'active' ? 'emerald' : 'neutral'} caps={false}>
          {status === 'active' ? 'Active' : 'On hold'}
        </Badge>
      </div>

      {typeof progress === 'number' ? (
        <div className="mt-5">
          <div className="flex justify-between text-xs font-semibold text-slate-500">
            <span>Operational readiness</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {modules?.length ? (
        <ul className="mt-5 space-y-2 text-sm text-slate-600">
          {modules.map((m) => (
            <li key={m} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {m}
            </li>
          ))}
        </ul>
      ) : null}
    </motion.div>
  );
}

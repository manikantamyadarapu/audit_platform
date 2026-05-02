import { cn } from '../../utils/cn';

const tones = {
  default: 'bg-slate-100 text-slate-700 border-slate-200/80',
  blue: 'bg-blue-50 text-blue-800 border-blue-200/60',
  amber: 'bg-amber-50 text-amber-900 border-amber-200/70',
  rose: 'bg-rose-50 text-rose-800 border-rose-200/70',
  emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/70',
  violet: 'bg-violet-50 text-violet-800 border-violet-200/70',
  slate: 'bg-slate-800 text-slate-100 border-slate-700',
};

export function Badge({ className, tone = 'default', caps = true, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        caps && 'uppercase',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

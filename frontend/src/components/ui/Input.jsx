import { cn } from '../../utils/cn';

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-800 shadow-[0_8px_22px_rgba(15,23,42,0.06)] outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/15',
        className
      )}
      {...props}
    />
  );
}

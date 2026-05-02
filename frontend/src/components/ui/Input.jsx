import { cn } from '../../utils/cn';

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-slate-200/90 bg-white/90 px-4 py-2.5 text-sm text-slate-800 shadow-inner shadow-slate-200/40 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20',
        className
      )}
      {...props}
    />
  );
}

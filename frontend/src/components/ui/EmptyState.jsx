import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';

export function EmptyState({ icon: Icon = Inbox, title, description, className, children }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-white/50 px-8 py-16 text-center backdrop-blur-sm',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100/80 text-slate-400 ring-1 ring-slate-200/60">
        <Icon className="h-8 w-8" strokeWidth={1.25} />
      </div>
      <h3 className="mt-5 text-base font-semibold text-slate-800">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}

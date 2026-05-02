import { cn } from '../../utils/cn';

export function Card({ className, children }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/60 bg-white/65 backdrop-blur-xl shadow-[var(--shadow-glass)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={cn('border-b border-slate-200/60 px-6 py-4', className)}>{children}</div>;
}

export function CardBody({ className, children }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>;
}

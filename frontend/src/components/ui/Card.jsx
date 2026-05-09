import { cn } from '../../utils/cn';

export function Card({ className, children }) {
  return (
    <div
      className={cn(
        'rounded-[18px] border border-slate-200/70 bg-[var(--color-surface-elevated)] shadow-[var(--shadow-glass)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children }) {
  return <div className={cn('border-b border-slate-100 px-6 py-4', className)}>{children}</div>;
}

export function CardBody({ className, children }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>;
}

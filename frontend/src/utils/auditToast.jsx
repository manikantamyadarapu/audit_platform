import toast from 'react-hot-toast';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const toastStyles = {
  success: {
    icon: CheckCircle2,
    accent: 'text-emerald-600',
  },
  error: {
    icon: AlertCircle,
    accent: 'text-rose-600',
  },
  default: {
    icon: Info,
    accent: 'text-sky-600',
  },
};

function AuditToastContent({ message, type = 'default' }) {
  const config = toastStyles[type] || toastStyles.default;
  const Icon = config.icon;

  return (
    <div className="flex min-w-[220px] max-w-[360px] items-center gap-2.5 rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-3.5 py-2.5 shadow-md">
      <Icon className={`h-4 w-4 shrink-0 ${config.accent}`} strokeWidth={1.75} />
      <p className="text-sm leading-snug text-[var(--color-text-primary)]">{message}</p>
    </div>
  );
}

export function showAuditToast(message, type = 'default') {
  return toast.custom(<AuditToastContent message={message} type={type} />, {
    duration: type === 'error' ? 5200 : 4200,
  });
}

export function auditToastSuccess(message) {
  return showAuditToast(message, 'success');
}

export function auditToastError(message) {
  return showAuditToast(message, 'error');
}

export function auditToastInfo(message) {
  return showAuditToast(message, 'default');
}

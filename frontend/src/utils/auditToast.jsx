import toast from 'react-hot-toast';
import { CheckCircle2, AlertCircle, Info, Sparkles } from 'lucide-react';

const toastStyles = {
  success: {
    icon: CheckCircle2,
    accent: 'text-emerald-500',
    ring: 'ring-emerald-500/20',
    glow: 'shadow-[0_12px_40px_rgba(16,185,129,0.18)]',
  },
  error: {
    icon: AlertCircle,
    accent: 'text-rose-500',
    ring: 'ring-rose-500/20',
    glow: 'shadow-[0_12px_40px_rgba(244,63,94,0.18)]',
  },
  default: {
    icon: Info,
    accent: 'text-sky-500',
    ring: 'ring-sky-500/20',
    glow: 'shadow-[0_12px_40px_rgba(14,165,233,0.15)]',
  },
};

function AuditToastContent({ message, type = 'default' }) {
  const config = toastStyles[type] || toastStyles.default;
  const Icon = config.icon;

  return (
    <div
      className={`flex min-w-[280px] max-w-[380px] items-start gap-3 rounded-[18px] border border-white/50 bg-white/80 p-3.5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/85 ${config.glow}`}
    >
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/70 ring-1 ${config.ring} dark:bg-white/5`}
      >
        <Icon className={`h-4 w-4 ${config.accent}`} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Audit platform
        </p>
        <p className="mt-0.5 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
          {message}
        </p>
      </div>
      <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-violet-400/70" strokeWidth={1.75} />
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

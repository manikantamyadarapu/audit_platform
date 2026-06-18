import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const STATUS_MESSAGES = [
  'Loading workbook',
  'Detecting headers',
  'Reading records',
  'Validating audit rules',
  'Generating report',
];

const STATUS_INTERVAL_MS = 1800;

const scopeClasses = {
  viewport: cn(
    'fixed inset-0 z-50 flex items-center justify-center',
    'bg-white/72 backdrop-blur-[20px] backdrop-saturate-150',
    'dark:bg-[#060b18]/84 dark:backdrop-blur-[24px]'
  ),
  container: cn(
    'absolute inset-0 z-40 flex items-center justify-center rounded-2xl',
    'bg-white/68 backdrop-blur-[16px] backdrop-saturate-150',
    'dark:bg-[#060b18]/80 dark:backdrop-blur-[20px]'
  ),
};

function AuditEngineRing() {
  const gradientId = useId().replace(/:/g, '');

  const size = 132;
  const center = size / 2;
  const radius = 54;
  const stroke = 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.18;
  const tailLength = circumference * 0.32;

  return (
    <div className="relative flex h-[132px] w-[132px] items-center justify-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-audit-engine-glow motion-reduce:animate-none rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.22)_0%,rgba(7,129,47,0.08)_42%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(16,185,129,0.28)_0%,rgba(7,129,47,0.1)_42%,transparent_70%)]"
      />

      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-slate-200/90 dark:text-slate-700/45"
        />
      </svg>

      <svg
        className="absolute inset-0 h-full w-full animate-audit-ring-spin motion-reduce:animate-none"
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
            <stop offset="62%" stopColor="#07812f" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
          </linearGradient>
        </defs>

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${tailLength} ${circumference - tailLength}`}
          transform={`rotate(-90 ${center} ${center})`}
          opacity="0.55"
        />

        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
          transform={`rotate(-90 ${center} ${center})`}
          className="dark:stroke-emerald-400"
        />

        <circle
          cx={center}
          cy={center - radius}
          r={2.5}
          fill="#34d399"
          className="dark:fill-emerald-300"
        />
      </svg>

      <span className="relative z-10 select-none font-sans text-[0.8125rem] font-semibold tracking-[0.22em] text-slate-700 dark:text-slate-200">
        HAA
      </span>
    </div>
  );
}

function StatusDots({ activeIndex }) {
  return (
    <div className="mt-5 flex items-center justify-center gap-2" aria-hidden>
      {STATUS_MESSAGES.map((_, index) => {
        const isActive = index === activeIndex;
        const isComplete = index < activeIndex;

        return (
          <motion.span
            key={index}
            layout
            animate={{
              width: isActive ? 18 : 6,
              opacity: isActive ? 1 : isComplete ? 0.55 : 0.28,
            }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'h-1.5 rounded-full',
              isActive || isComplete
                ? 'bg-emerald-500 dark:bg-emerald-400'
                : 'bg-slate-300 dark:bg-slate-600'
            )}
          />
        );
      })}
    </div>
  );
}

export function AuditValidationOverlay({ open, scope = 'viewport', className }) {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    if (!open || scope !== 'viewport' || typeof document === 'undefined') return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, scope]);

  useEffect(() => {
    if (!open) {
      setStatusIndex(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setStatusIndex((current) => Math.min(current + 1, STATUS_MESSAGES.length - 1));
    }, STATUS_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [open]);

  const activeStatus = STATUS_MESSAGES[statusIndex];

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className={cn(scopeClasses[scope] ?? scopeClasses.viewport, className)}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={`Audit processing: ${activeStatus}`}
        >
          <div className="flex flex-col items-center px-6 text-center">
            <p className="mb-7 font-sans text-[14px] font-medium uppercase tracking-[0.24em] text-slate-400/90 dark:text-slate-500">
              Audit Intelligence Engine
            </p>

            <AuditEngineRing />

            <div className="relative mt-8 h-5 w-full max-w-[16rem]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={statusIndex}
                  initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-x-0 font-sans text-[13px] font-normal tracking-[0.01em] text-slate-600 dark:text-slate-300"
                >
                  {activeStatus}
                </motion.p>
              </AnimatePresence>
            </div>

            <StatusDots activeIndex={statusIndex} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (scope === 'viewport' && typeof document !== 'undefined') {
    return createPortal(overlay, document.body);
  }

  return overlay;
}

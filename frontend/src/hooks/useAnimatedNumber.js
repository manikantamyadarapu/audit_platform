import { useEffect, useState } from 'react';

/**
 * @param {number | null} target
 * @param {{ duration?: number, enabled?: boolean }} [options]
 */
export function useAnimatedNumber(target, options = {}) {
  const { duration = 700, enabled = true } = options;
  const [value, setValue] = useState(enabled && target != null ? 0 : target);

  useEffect(() => {
    if (!enabled || target == null || !Number.isFinite(target)) {
      setValue(target);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, enabled]);

  return value;
}

/** @param {unknown} value */
export function parseMetricNumber(value) {
  if (value == null || value === '—' || value === 'View') return null;
  const text = String(value).replace(/,/g, '').trim();
  const match = text.match(/-?\d+(\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/** @param {unknown} value */
export function isPercentMetric(value) {
  return String(value ?? '').includes('%');
}

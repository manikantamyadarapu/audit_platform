/**
 * Format numbers Apple-style with Indian locale (1,25,000)
 */
export function formatNumber(n, decimals = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-IN', { 
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals 
  }).format(Number(n));
}

/**
 * Format percentage Apple-style (12.5%)
 */
export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value) / 100);
}

export function effectivePan(row) {
  const a = row?.pan?.trim?.() || row?.pan;
  const b = row?.pan1?.trim?.() || row?.pan1;
  const first = a ? String(a) : '';
  const second = b ? String(b) : '';
  if (first && second && first !== second) return `${first} / ${second}`;
  return first || second || '—';
}

export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(n));
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(digits)}%`;
}

export function effectivePan(row) {
  const a = row?.pan?.trim?.() || row?.pan;
  const b = row?.pan1?.trim?.() || row?.pan1;
  const first = a ? String(a) : '';
  const second = b ? String(b) : '';
  if (first && second && first !== second) return `${first} / ${second}`;
  return first || second || '—';
}

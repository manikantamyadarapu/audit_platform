/**
 * Indian numbering system (lakhs/crores): 1,000 · 10,000 · 1,00,000 · 1,00,00,000
 * Display only — underlying numeric values are unchanged.
 */

/**
 * @param {number|null|undefined} n
 * @param {{ minDecimals?: number, maxDecimals?: number, fallback?: string }} [options]
 * @returns {string}
 */
export function formatIndianNumber(n, options = {}) {
  const { minDecimals = 0, maxDecimals = 4, fallback = '—' } = options;
  if (n === null || n === undefined || Number.isNaN(Number(n))) return fallback;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  }).format(Number(n));
}

/**
 * @param {number|null|undefined} n
 * @param {number} [decimals=0]
 * @returns {string}
 */
export function formatNumber(n, decimals = 0) {
  return formatIndianNumber(n, { minDecimals: decimals, maxDecimals: decimals });
}

/**
 * @param {number|null|undefined} value
 * @param {number} [digits=1]
 * @returns {string}
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

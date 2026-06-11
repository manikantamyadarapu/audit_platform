/**
 * Apple-style formatting utilities
 * Uses San Francisco font conventions and locale-aware number formatting
 */

/**
 * Format numbers like Apple (locale-aware, proper grouping)
 * @param {number} value
 * @param {number} decimals - Default 0 for integers, 2 for currency
 * @returns {string}
 */
export function formatAppleNumber(value, decimals = 0) {
  if (value == null || isNaN(value)) return '—';
  
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: true,
  }).format(value);
}

/**
 * Format currency in Apple style (₹ 1,25,000.00)
 * @param {number} value
 * @returns {string}
 */
export function formatAppleCurrency(value) {
  if (value == null || isNaN(value)) return '—';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format percentage Apple style (12.5%)
 * @param {number} value - 0.125 = 12.5%
 * @param {number} decimals
 * @returns {string}
 */
export function formatApplePercent(value, decimals = 1) {
  if (value == null || isNaN(value)) return '—';
  
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format compact numbers (1.2K, 3.5M) - Apple style
 * @param {number} value
 * @returns {string}
 */
export function formatAppleCompact(value) {
  if (value == null || isNaN(value)) return '—';
  
  return new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format date Apple style (29 May 2026)
 * @param {Date|string} date
 * @returns {string}
 */
export function formatAppleDate(date) {
  if (!date) return '—';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Format time Apple style (2:30 PM)
 * @param {Date|string} date
 * @returns {string}
 */
export function formatAppleTime(date) {
  if (!date) return '—';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Smart ellipsis - Apple style truncation (…)
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function appleTruncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trim() + '…';
}

/**
 * Convert straight quotes to smart quotes (typographer's quotes)
 * @param {string} text
 * @returns {string}
 */
export function appleSmartQuotes(text) {
  if (!text) return text;
  
  return text
    .replace(/"([^"]*)"/g, '「$1」')  // Double quotes
    .replace(/'([^']*)'/g, '『$1』')   // Single quotes
    .replace(/--/g, '–')               // En dash
    .replace(/\.\.\./g, '…');          // Ellipsis
}

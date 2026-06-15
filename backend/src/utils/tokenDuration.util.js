/**
 * Parse duration strings like 15m, 7d, 24h into milliseconds.
 * @param {string} value
 * @param {number} fallbackMs
 */
function parseDurationMs(value, fallbackMs) {
  if (!value || typeof value !== 'string') return fallbackMs;
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (multipliers[unit] || 0) || fallbackMs;
}

module.exports = {
  parseDurationMs,
};

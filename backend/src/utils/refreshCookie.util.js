const config = require('../config');

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/api/auth';

/** Parse jwt expiresIn-style values (e.g. 7d, 15m, 3600) into milliseconds. */
function expiresInToMs(value, fallbackMs) {
  const raw = String(value || '').trim();
  if (!raw) return fallbackMs;
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;

  const match = /^(\d+)([smhd])$/i.exec(raw);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (multipliers[unit] || 0) || fallbackMs;
}

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
  };
}

function setRefreshTokenCookie(res, refreshToken) {
  const maxAgeMs = expiresInToMs(config.REFRESH_TOKEN_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...getRefreshCookieOptions(),
    maxAge: maxAgeMs,
  });
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
}

function getRefreshTokenFromRequest(req) {
  return req.cookies?.[REFRESH_COOKIE_NAME] || null;
}

module.exports = {
  REFRESH_COOKIE_NAME,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
};

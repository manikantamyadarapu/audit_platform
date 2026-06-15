const config = require('../config');

const REFRESH_COOKIE_NAME = 'refreshToken';

function getRefreshCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: maxAgeMs,
  };
}

function setRefreshTokenCookie(res, token, maxAgeMs) {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions(maxAgeMs));
}

function clearRefreshTokenCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/api',
  });
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

const crypto = require('crypto');

/** @type {Map<string, { userId: number, expiresAt: number }>} */
const activeTokens = new Map();

function createJti() {
  return crypto.randomBytes(16).toString('hex');
}

function registerToken(jti, userId, expiresAtMs) {
  activeTokens.set(jti, { userId, expiresAt: expiresAtMs });
}

function isTokenActive(jti) {
  const entry = activeTokens.get(jti);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    activeTokens.delete(jti);
    return false;
  }
  return true;
}

function revokeToken(jti) {
  activeTokens.delete(jti);
}

function revokeAllForUser(userId) {
  for (const [jti, entry] of activeTokens) {
    if (entry.userId === userId) {
      activeTokens.delete(jti);
    }
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [jti, entry] of activeTokens) {
    if (now > entry.expiresAt) {
      activeTokens.delete(jti);
    }
  }
}, 60 * 60 * 1000).unref();

module.exports = {
  createJti,
  registerToken,
  isTokenActive,
  revokeToken,
  revokeAllForUser,
};

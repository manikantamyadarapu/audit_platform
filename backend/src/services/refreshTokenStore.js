const crypto = require('crypto');
const prisma = require('../lib/prisma');

function createJti() {
  return crypto.randomBytes(16).toString('hex');
}

function hashJti(jti) {
  return crypto.createHash('sha256').update(String(jti)).digest('hex');
}

/**
 * Persist a refresh-token JTI in AuthToken (survives restarts / multi-instance).
 * @param {string} jti
 * @param {number} userId
 * @param {number} expiresAtMs
 */
async function registerToken(jti, userId, expiresAtMs) {
  const tokenHash = hashJti(jti);
  await prisma.authToken.upsert({
    where: { tokenHash },
    create: {
      userId: Number(userId),
      tokenHash,
      type: 'REFRESH',
      expiresAt: new Date(expiresAtMs),
    },
    update: {
      userId: Number(userId),
      expiresAt: new Date(expiresAtMs),
      usedAt: null,
    },
  });
}

/**
 * @param {string} jti
 * @returns {Promise<boolean>}
 */
async function isTokenActive(jti) {
  if (!jti) return false;
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashJti(jti) },
    select: { id: true, type: true, expiresAt: true, usedAt: true },
  });
  if (!row || row.type !== 'REFRESH' || row.usedAt) {
    return false;
  }
  if (Date.now() > row.expiresAt.getTime()) {
    await prisma.authToken.delete({ where: { id: row.id } }).catch(() => {});
    return false;
  }
  return true;
}

/**
 * @param {string} jti
 */
async function revokeToken(jti) {
  if (!jti) return;
  await prisma.authToken
    .deleteMany({
      where: { tokenHash: hashJti(jti), type: 'REFRESH' },
    })
    .catch(() => {});
}

/**
 * @param {number} userId
 */
async function revokeAllForUser(userId) {
  await prisma.authToken
    .deleteMany({
      where: { userId: Number(userId), type: 'REFRESH' },
    })
    .catch(() => {});
}

module.exports = {
  createJti,
  registerToken,
  isTokenActive,
  revokeToken,
  revokeAllForUser,
};

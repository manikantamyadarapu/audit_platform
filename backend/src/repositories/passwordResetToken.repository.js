const prisma = require('../lib/prisma');

async function invalidateUserTokens(userId) {
  await prisma.authToken.updateMany({
    where: { userId, type: 'PASSWORD_RESET', usedAt: null },
    data: { usedAt: new Date() },
  });
}

async function createToken({ userId, tokenHash, expiresAt }) {
  return prisma.authToken.create({
    data: {
      userId,
      tokenHash,
      type: 'PASSWORD_RESET',
      expiresAt,
    },
  });
}

async function findValidByTokenHash(tokenHash) {
  return prisma.authToken.findFirst({
    where: {
      tokenHash,
      type: 'PASSWORD_RESET',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          isActive: true,
        },
      },
    },
  });
}

async function markUsed(id) {
  return prisma.authToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}

module.exports = {
  invalidateUserTokens,
  createToken,
  findValidByTokenHash,
  markUsed,
};

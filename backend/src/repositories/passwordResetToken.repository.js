const prisma = require('../lib/prisma');

async function invalidateUserTokens(userId) {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

async function createToken({ userId, tokenHash, expiresAt }) {
  return prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

async function findValidByTokenHash(tokenHash) {
  return prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
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
  return prisma.passwordResetToken.update({
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

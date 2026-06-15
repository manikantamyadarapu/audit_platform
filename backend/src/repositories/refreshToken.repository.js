const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function create({ userId, tokenHash, expiresAt }) {
  return prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
}

async function findValidByHash(tokenHash) {
  return prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
  });
}

async function deleteByHash(tokenHash) {
  return prisma.refreshToken.deleteMany({
    where: { tokenHash },
  });
}

async function deleteAllForUser(userId) {
  return prisma.refreshToken.deleteMany({
    where: { userId },
  });
}

async function deleteExpired() {
  return prisma.refreshToken.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
}

module.exports = {
  create,
  findValidByHash,
  deleteByHash,
  deleteAllForUser,
  deleteExpired,
};

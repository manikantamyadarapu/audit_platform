const prisma = require('../lib/prisma');

function mapRow(row) {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    actionUrl: row.actionUrl,
    metadata: row.metadata,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    isRead: Boolean(row.readAt),
  };
}

async function create(data) {
  const row = await prisma.notification.create({ data });
  return mapRow(row);
}

async function findByUser(userId, { limit = 30, unreadOnly = false } = {}) {
  const where = { userId };
  if (unreadOnly) {
    where.readAt = null;
  }
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });
  return rows.map(mapRow);
}

async function countUnread(userId) {
  return prisma.notification.count({
    where: { userId, readAt: null },
  });
}

async function markRead(userId, notificationId) {
  const row = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });
  return row.count > 0;
}

async function markAllRead(userId) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}

async function findRecentByTypeAndMetadata(userId, type, metadataKey, metadataValue, since) {
  const rows = await prisma.notification.findMany({
    where: {
      userId,
      type,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.filter((row) => {
    const meta = row.metadata;
    if (!meta || typeof meta !== 'object') return false;
    return meta[metadataKey] === metadataValue;
  });
}

module.exports = {
  create,
  findByUser,
  countUnread,
  markRead,
  markAllRead,
  findRecentByTypeAndMetadata,
};

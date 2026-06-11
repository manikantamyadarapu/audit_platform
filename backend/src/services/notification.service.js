const notificationRepository = require('../repositories/notification.repository');
const { syncSessionExpiringNotifications } = require('./auditNotification.service');

async function listForUser(userId, { limit = 30, unreadOnly = false } = {}) {
  await syncSessionExpiringNotifications(userId);

  const [items, unreadCount] = await Promise.all([
    notificationRepository.findByUser(userId, { limit, unreadOnly }),
    notificationRepository.countUnread(userId),
  ]);

  return { items, unreadCount };
}

async function markRead(userId, notificationId) {
  const ok = await notificationRepository.markRead(userId, notificationId);
  if (!ok) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }
  return notificationRepository.countUnread(userId);
}

async function markAllRead(userId) {
  await notificationRepository.markAllRead(userId);
  return 0;
}

module.exports = {
  listForUser,
  markRead,
  markAllRead,
};

import Notification from '../models/notificationModel.js';

export async function getMyNotifications(req, res) {
  try {
    const userId = req.user.id;

    const notifications = await Notification.getAllByUserId(userId);
    const unreadCount = await Notification.countUnreadByUserId(userId);

    res.json({
      unreadCount,
      notifications
    });
  } catch (err) {
    console.error('[getMyNotifications]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markNotificationAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await Notification.markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(notification);
  } catch (err) {
    console.error('[markNotificationAsRead]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function markAllNotificationsAsRead(req, res) {
  try {
    const userId = req.user.id;

    const notifications = await Notification.markAllAsRead(userId);

    res.json({
      message: 'All notifications marked as read',
      notifications
    });
  } catch (err) {
    console.error('[markAllNotificationsAsRead]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteNotification(req, res) {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const notification = await Notification.delete(notificationId, userId);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      message: 'Notification deleted',
      notification
    });
  } catch (err) {
    console.error('[deleteNotification]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

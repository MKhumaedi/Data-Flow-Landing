import { Router } from 'express';
import { notificationController } from './notification.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole.middleware';

export const notificationRoutes = Router();

// User notifications (authenticated)
notificationRoutes.get(
  '/unread-count',
  requireAuth,
  (req, res) => notificationController.getUnreadCount(req, res)
);

// Real-time SSE Stream
notificationRoutes.get(
  '/stream',
  requireAuth,
  (req, res) => notificationController.streamNotifications(req, res)
);

notificationRoutes.get(
  '/',
  requireAuth,
  (req, res) => notificationController.getNotifications(req, res)
);

// Mark all as read
notificationRoutes.patch(
  '/read-all',
  requireAuth,
  (req, res) => notificationController.markAllAsRead(req, res)
);

notificationRoutes.post(
  '/read-all',
  requireAuth,
  (req, res) => notificationController.markAllAsRead(req, res)
);

// Single notification actions
notificationRoutes.patch(
  '/:id/read',
  requireAuth,
  (req, res) => notificationController.markAsRead(req, res)
);

notificationRoutes.post(
  '/:id/read',
  requireAuth,
  (req, res) => notificationController.markAsRead(req, res)
);

notificationRoutes.delete(
  '/:id',
  requireAuth,
  (req, res) => notificationController.deleteNotification(req, res)
);

// Admin broadcast routes
export const adminNotificationRoutes = Router();

adminNotificationRoutes.post(
  '/broadcast',
  requireAuth,
  requireRole(['SUPERADMIN']),
  (req, res) => notificationController.sendBroadcast(req, res)
);

adminNotificationRoutes.get(
  '/broadcasts',
  requireAuth,
  requireRole(['SUPERADMIN']),
  (req, res) => notificationController.getBroadcasts(req, res)
);

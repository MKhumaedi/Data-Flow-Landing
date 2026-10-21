import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { logger } from '../../lib/logger';

export class NotificationController {
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const count = await notificationService.getUnreadCount(userId);
    res.json({ success: true, count });
  }

  async getNotifications(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const result = await notificationService.getUserNotifications(userId, limit, offset);
    res.json({
      success: true,
      items: result.items,
      total: result.total,
      unreadCount: result.unreadCount,
      data: result,
    });
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { id } = req.params;
    if (!userId || !id) {
      res.status(400).json({ success: false, message: 'Bad request' });
      return;
    }
    await notificationService.markAsRead(id, userId);
    res.json({ success: true, message: 'Notification marked as read' });
  }

  async markAllAsRead(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const markedCount = await notificationService.markAllAsRead(userId);
    res.json({ success: true, markedCount });
  }

  async deleteNotification(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { id } = req.params;
    if (!userId || !id) {
      res.status(400).json({ success: false, message: 'Bad request' });
      return;
    }
    await notificationService.deleteNotification(id, userId);
    res.json({ success: true, message: 'Notifikasi berhasil dihapus' });
  }

  /**
   * Real-time Server-Sent Events (SSE) Stream endpoint
   * GET /api/notifications/stream
   */
  async streamNotifications(req: Request, res: Response): Promise<void> {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.flushHeaders?.();
    notificationService.addSseClient(userId, res);
  }

  async sendBroadcast(req: Request, res: Response): Promise<void> {
    const admin = (req as any).user;
    const { title, message, type, link } = req.body;

    if (!title?.trim() || !message?.trim()) {
      res.status(400).json({ success: false, message: 'Judul dan pesan pengumuman wajib diisi' });
      return;
    }

    const validTypes = ['CONTENT_UPDATE', 'FEATURE_UPDATE', 'GENERAL'];
    const chosenType = validTypes.includes(type) ? type : 'GENERAL';

    try {
      const record = await notificationService.createBroadcast(
        { title: title.trim(), message: message.trim(), type: chosenType, link: link?.trim() || null },
        admin
      );
      res.json({ success: true, notification: record });
    } catch (err: any) {
      logger.error(`[NotificationController] sendBroadcast error: ${err.message}`);
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getBroadcasts(req: Request, res: Response): Promise<void> {
    const items = await notificationService.getBroadcastHistory();
    res.json({ success: true, items });
  }
}

export const notificationController = new NotificationController();

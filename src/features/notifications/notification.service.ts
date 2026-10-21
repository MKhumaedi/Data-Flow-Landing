import { Client } from 'pg';
import { Response } from 'express';
import { logger } from '../../lib/logger';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';
import {
  CreateNotificationDto,
  BroadcastNotificationDto,
  NotificationRecord,
} from './notification.types';

export function shouldIncludeNotification(
  type: string,
  preferences?: { transactions?: boolean; subscriptionReminders?: boolean; contentUpdates?: boolean } | null
): boolean {
  if (!preferences) return true;
  if (preferences.transactions === false && (type === 'TRANSACTION_SUCCESS' || type === 'TRANSACTION_FAILED')) {
    return false;
  }
  if (preferences.subscriptionReminders === false && (type === 'PREMIUM_EXPIRING_SOON' || type === 'PREMIUM_EXPIRED')) {
    return false;
  }
  if (preferences.contentUpdates === false && (type === 'CONTENT_UPDATE' || type === 'FEATURE_UPDATE')) {
    return false;
  }
  return true;
}

export class NotificationService {
  private inMemoryNotifications: NotificationRecord[] = [];
  private inMemoryReads: Map<string, Set<string>> = new Map(); // notificationId -> Set<userId>
  private inMemoryDeletions: Map<string, Set<string>> = new Map(); // notificationId -> Set<userId>
  private sseClients = new Map<string, Set<Response>>(); // userId -> Set<Response>
  private pingInterval: NodeJS.Timeout | null = null;
  private schemaEnsured = false;

  constructor() {
    this.startPingInterval();
  }

  private startPingInterval() {
    if (this.pingInterval) return;
    this.pingInterval = setInterval(() => {
      for (const [userId, clients] of this.sseClients.entries()) {
        for (const res of Array.from(clients)) {
          try {
            res.write(`:ping\n\n`);
          } catch {
            clients.delete(res);
          }
        }
        if (clients.size === 0) {
          this.sseClients.delete(userId);
        }
      }
    }, 25000);
  }

  /**
   * Register a user's SSE client for real-time notification stream
   */
  addSseClient(userId: string, res: Response): void {
    if (!this.sseClients.has(userId)) {
      this.sseClients.set(userId, new Set());
    }
    this.sseClients.get(userId)!.add(res);

    // Initial SSE connection handshake
    res.write(`:connected\n\n`);
    res.write(`event: ready\ndata: ${JSON.stringify({ userId, connectedAt: new Date().toISOString() })}\n\n`);

    logger.info(`[Notification SSE] User ${userId} connected to real-time notification stream (active: ${this.sseClients.get(userId)?.size})`);

    res.on('close', () => {
      const set = this.sseClients.get(userId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          this.sseClients.delete(userId);
        }
      }
      logger.info(`[Notification SSE] User ${userId} disconnected from real-time stream`);
    });
  }

  /**
   * Broadcast real-time event to specific user or all connected users
   */
  sendRealtimeNotification(notification: NotificationRecord): void {
    const payload = JSON.stringify(notification);
    const targetUserId = notification.user_id || notification.userId;

    if (targetUserId) {
      // Send strictly to this user based on user_id
      const clients = this.sseClients.get(targetUserId);
      if (clients && clients.size > 0) {
        for (const client of Array.from(clients)) {
          try {
            client.write(`event: notification\ndata: ${payload}\n\n`);
          } catch {
            clients.delete(client);
          }
        }
      }
    } else if (notification.scope === 'BROADCAST') {
      // Broadcast to all connected active clients
      for (const clients of this.sseClients.values()) {
        for (const client of Array.from(clients)) {
          try {
            client.write(`event: notification\ndata: ${payload}\n\n`);
          } catch {
            clients.delete(client);
          }
        }
      }
    }
  }

  private async ensureSchema(): Promise<void> {
    if (this.schemaEnsured) return;
    const client = this.getPgClient();
    if (!client) return;
    try {
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS "notifications" (
          "id" TEXT PRIMARY KEY,
          "user_id" TEXT,
          "userId" TEXT,
          "scope" TEXT NOT NULL DEFAULT 'USER',
          "type" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "link" TEXT,
          "is_read" BOOLEAN NOT NULL DEFAULT false,
          "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deleted_at" TIMESTAMP(3),
          "deletedAt" TIMESTAMP(3)
        );
        CREATE TABLE IF NOT EXISTS "notification_deletions" (
          "id" TEXT PRIMARY KEY,
          "notificationId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "uq_notif_user_del" UNIQUE ("notificationId", "userId")
        );
        CREATE TABLE IF NOT EXISTS "notification_reads" (
          "id" TEXT PRIMARY KEY,
          "notificationId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "uq_notif_user_read" UNIQUE ("notificationId", "userId")
        );
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "userId" TEXT;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN DEFAULT false;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
        ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
      `);
      this.schemaEnsured = true;
    } catch (err: any) {
      logger.warn(`[NotificationService] ensureSchema warning: ${err.message}`);
    } finally {
      await client.end().catch(() => null);
    }
  }

  private async resolveUserPreferences(userId: string) {
    try {
      const { authService } = await import('../auth/auth.service');
      const user = await authService.getUserById(userId);
      return user?.notificationPreferences || null;
    } catch {
      return null;
    }
  }

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  async createNotification(dto: CreateNotificationDto): Promise<NotificationRecord> {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();
    const targetUserId = dto.userId || dto.user_id || null;
    const scope = dto.scope || (targetUserId ? 'USER' : 'BROADCAST');

    const record: NotificationRecord = {
      id,
      scope,
      userId: targetUserId,
      user_id: targetUserId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      link: dto.link || null,
      createdAt,
      created_at: createdAt,
      deletedAt: null,
      deleted_at: null,
      isRead: false,
      is_read: false,
    };

    this.inMemoryNotifications.unshift(record);
    await this.persistNotification(record);

    // Send Real-Time SSE to target user immediately
    this.sendRealtimeNotification(record);

    return record;
  }

  private async persistNotification(record: NotificationRecord): Promise<void> {
    await this.ensureSchema();
    const client = this.getPgClient();
    if (!client) return;
    try {
      await client.connect();
      const targetUserId = record.user_id || record.userId;
      await client.query(
        `INSERT INTO "notifications" ("id", "scope", "userId", "user_id", "type", "title", "message", "link", "is_read", "createdAt", "created_at")
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7, false, NOW(), NOW())`,
        [record.id, record.scope, targetUserId, record.type, record.title, record.message, record.link]
      );
    } catch (err: any) {
      markDatabaseOffline(err);
    } finally {
      await client.end().catch(() => null);
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    await this.ensureSchema();
    const userPrefs = await this.resolveUserPreferences(userId);
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `SELECT n."id", n."type"
           FROM "notifications" n
           WHERE (n."deletedAt" IS NULL AND n."deleted_at" IS NULL)
             AND (n."scope" = 'BROADCAST' OR (COALESCE(n."user_id", n."userId") = $1))
             AND (n."is_read" = false OR n."is_read" IS NULL)
             AND NOT EXISTS (
               SELECT 1 FROM "notification_reads" nr 
               WHERE nr."notificationId" = n."id" AND nr."userId" = $1
             )
             AND NOT EXISTS (
               SELECT 1 FROM "notification_deletions" nd 
               WHERE nd."notificationId" = n."id" AND nd."userId" = $1
             )`,
          [userId]
        );
        const filtered = res.rows.filter((r) => shouldIncludeNotification(r.type, userPrefs));
        return filtered.length;
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }

    // In-memory fallback
    return this.inMemoryNotifications.filter((n) => {
      if (n.deletedAt || n.deleted_at) return false;
      if (this.inMemoryDeletions.get(n.id)?.has(userId)) return false;
      const isTarget = n.scope === 'BROADCAST' || (n.user_id === userId || n.userId === userId);
      if (!isTarget) return false;
      if (!shouldIncludeNotification(n.type, userPrefs)) return false;
      if (n.isRead || n.is_read) return false;
      const reads = this.inMemoryReads.get(n.id);
      return !reads?.has(userId);
    }).length;
  }

  async getUserNotifications(userId: string, limit = 20, offset = 0): Promise<{ items: NotificationRecord[]; total: number; unreadCount: number }> {
    await this.ensureSchema();
    const userPrefs = await this.resolveUserPreferences(userId);
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const query = `
          SELECT 
            n."id",
            COALESCE(n."user_id", n."userId") as "user_id",
            COALESCE(n."userId", n."user_id") as "userId",
            n."scope",
            n."type",
            n."title",
            n."message",
            n."link",
            COALESCE(n."created_at", n."createdAt") as "created_at",
            COALESCE(n."createdAt", n."created_at") as "createdAt",
            CASE 
              WHEN n."is_read" = true OR nr."id" IS NOT NULL THEN true 
              ELSE false 
            END as "is_read"
          FROM "notifications" n
          LEFT JOIN "notification_reads" nr ON nr."notificationId" = n."id" AND nr."userId" = $1
          WHERE (n."deletedAt" IS NULL AND n."deleted_at" IS NULL)
            AND (n."scope" = 'BROADCAST' OR (COALESCE(n."user_id", n."userId") = $1))
            AND NOT EXISTS (
              SELECT 1 FROM "notification_deletions" nd 
              WHERE nd."notificationId" = n."id" AND nd."userId" = $1
            )
          ORDER BY COALESCE(n."created_at", n."createdAt") DESC
        `;
        const res = await client.query(query, [userId]);

        const allItems: NotificationRecord[] = res.rows
          .map((r) => {
            const isRead = Boolean(r.is_read);
            const dateStr = new Date(r.created_at || r.createdAt).toISOString();
            return {
              id: r.id,
              scope: r.scope,
              userId: r.userId,
              user_id: r.user_id,
              type: r.type,
              title: r.title,
              message: r.message,
              link: r.link,
              createdAt: dateStr,
              created_at: dateStr,
              isRead,
              is_read: isRead,
            };
          })
          .filter((n) => shouldIncludeNotification(n.type, userPrefs));

        const unreadCount = allItems.filter((item) => !item.is_read).length;

        return {
          items: allItems.slice(offset, offset + limit),
          total: allItems.length,
          unreadCount,
        };
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const filtered = this.inMemoryNotifications
      .filter((n) => {
        if (n.deletedAt || n.deleted_at) return false;
        if (this.inMemoryDeletions.get(n.id)?.has(userId)) return false;
        const isTarget = n.scope === 'BROADCAST' || (n.user_id === userId || n.userId === userId);
        if (!isTarget) return false;
        return shouldIncludeNotification(n.type, userPrefs);
      })
      .map((n) => {
        const isRead = Boolean(n.isRead || n.is_read || this.inMemoryReads.get(n.id)?.has(userId));
        return {
          ...n,
          isRead,
          is_read: isRead,
        };
      });

    const unreadCount = filtered.filter((i) => !i.is_read).length;

    return {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      unreadCount,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    await this.ensureSchema();
    const inMem = this.inMemoryNotifications.find((n) => n.id === notificationId);
    if (inMem && (inMem.userId === userId || inMem.user_id === userId || inMem.scope === 'BROADCAST')) {
      inMem.isRead = true;
      inMem.is_read = true;
    }
    if (!this.inMemoryReads.has(notificationId)) {
      this.inMemoryReads.set(notificationId, new Set());
    }
    this.inMemoryReads.get(notificationId)!.add(userId);

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(
          `UPDATE "notifications"
           SET "is_read" = true
           WHERE "id" = $1 AND (COALESCE("user_id", "userId") = $2 OR "scope" = 'BROADCAST')`,
          [notificationId, userId]
        );
        await client.query(
          `INSERT INTO "notification_reads" ("id", "notificationId", "userId", "readAt")
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT ("notificationId", "userId") DO NOTHING`,
          [`read-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, notificationId, userId]
        );
      } catch (err: any) {
        logger.warn(`[NotificationService] markAsRead error: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    // Broadcast real-time read event to user's connected tabs
    const clients = this.sseClients.get(userId);
    if (clients) {
      for (const client of Array.from(clients)) {
        try {
          client.write(`event: notification_read\ndata: ${JSON.stringify({ id: notificationId })}\n\n`);
        } catch {
          clients.delete(client);
        }
      }
    }

    return true;
  }

  async markAllAsRead(userId: string): Promise<number> {
    await this.ensureSchema();
    let markedCount = 0;

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const updateRes = await client.query(
          `UPDATE "notifications"
           SET "is_read" = true
           WHERE (COALESCE("user_id", "userId") = $1)
             AND ("deletedAt" IS NULL AND "deleted_at" IS NULL)`,
          [userId]
        );
        const insertRes = await client.query(
          `INSERT INTO "notification_reads" ("id", "notificationId", "userId", "readAt")
           SELECT 'read-' || floor(random()*10000000)::text || '-' || substr(md5(random()::text), 1, 6),
                  n."id", $1, NOW()
           FROM "notifications" n
           WHERE (n."deletedAt" IS NULL AND n."deleted_at" IS NULL)
             AND (n."scope" = 'BROADCAST' OR (COALESCE(n."user_id", n."userId") = $1))
             AND NOT EXISTS (
               SELECT 1 FROM "notification_reads" nr 
               WHERE nr."notificationId" = n."id" AND nr."userId" = $1
             )
           ON CONFLICT ("notificationId", "userId") DO NOTHING`,
          [userId]
        );
        markedCount = (updateRes.rowCount || 0) + (insertRes.rowCount || 0);
      } catch (err: any) {
        logger.warn(`[NotificationService] markAllAsRead error: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    for (const n of this.inMemoryNotifications) {
      if (n.scope === 'BROADCAST' || n.userId === userId || n.user_id === userId) {
        n.isRead = true;
        n.is_read = true;
        if (!this.inMemoryReads.has(n.id)) {
          this.inMemoryReads.set(n.id, new Set());
        }
        if (!this.inMemoryReads.get(n.id)!.has(userId)) {
          this.inMemoryReads.get(n.id)!.add(userId);
          markedCount++;
        }
      }
    }

    // Broadcast real-time all-read event to user's connected tabs
    const clients = this.sseClients.get(userId);
    if (clients) {
      for (const client of Array.from(clients)) {
        try {
          client.write(`event: notifications_all_read\ndata: ${JSON.stringify({ userId, markedCount })}\n\n`);
        } catch {
          clients.delete(client);
        }
      }
    }

    return markedCount;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    await this.ensureSchema();

    // 1. In-memory deletion
    if (!this.inMemoryDeletions.has(notificationId)) {
      this.inMemoryDeletions.set(notificationId, new Set());
    }
    this.inMemoryDeletions.get(notificationId)!.add(userId);

    const idx = this.inMemoryNotifications.findIndex(
      (n) => n.id === notificationId && (n.userId === userId || n.user_id === userId)
    );
    if (idx !== -1) {
      this.inMemoryNotifications[idx].deletedAt = new Date().toISOString();
      this.inMemoryNotifications[idx].deleted_at = new Date().toISOString();
      this.inMemoryNotifications.splice(idx, 1);
    }

    // 2. Database soft-delete & user-dismissal record
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        // Soft delete if it is this user's specific notification
        await client.query(
          `UPDATE "notifications"
           SET "deletedAt" = NOW(), "deleted_at" = NOW()
           WHERE "id" = $1 AND (COALESCE("user_id", "userId") = $2)`,
          [notificationId, userId]
        );
        // Record user dismissal so user never sees broadcast or shared notif
        await client.query(
          `INSERT INTO "notification_deletions" ("id", "notificationId", "userId", "deletedAt")
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT ("notificationId", "userId") DO NOTHING`,
          [`del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, notificationId, userId]
        );
      } catch (err: any) {
        logger.warn(`[NotificationService] deleteNotification error: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    // 3. Broadcast real-time deletion event to user's connected tabs
    const clients = this.sseClients.get(userId);
    if (clients) {
      for (const client of Array.from(clients)) {
        try {
          client.write(`event: notification_deleted\ndata: ${JSON.stringify({ id: notificationId })}\n\n`);
        } catch {
          clients.delete(client);
        }
      }
    }

    return true;
  }

  async createBroadcast(dto: BroadcastNotificationDto, adminUser: { id: string; email?: string }): Promise<NotificationRecord> {
    const record = await this.createNotification({
      scope: 'BROADCAST',
      userId: null,
      user_id: null,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      link: dto.link,
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'NOTIFICATION_BROADCAST_SENT',
      targetType: 'NOTIFICATION',
      targetId: record.id,
      details: {
        title: record.title,
        message: record.message,
        type: record.type,
        link: record.link,
      },
    });

    return record;
  }

  async getBroadcastHistory(limit = 50): Promise<NotificationRecord[]> {
    await this.ensureSchema();
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `SELECT * FROM "notifications" WHERE "scope" = 'BROADCAST' AND ("deletedAt" IS NULL AND "deleted_at" IS NULL) ORDER BY COALESCE("created_at", "createdAt") DESC LIMIT $1`,
          [limit]
        );
        return res.rows.map((r) => {
          const isRead = Boolean(r.is_read);
          const dateStr = new Date(r.created_at || r.createdAt).toISOString();
          return {
            id: r.id,
            scope: r.scope,
            userId: r.userId,
            user_id: r.user_id,
            type: r.type,
            title: r.title,
            message: r.message,
            link: r.link,
            createdAt: dateStr,
            created_at: dateStr,
            isRead,
            is_read: isRead,
          };
        });
      } catch (err: any) {
        logger.warn(`[NotificationService] getBroadcastHistory error: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }
    return this.inMemoryNotifications.filter((n) => n.scope === 'BROADCAST' && !n.deletedAt && !n.deleted_at).slice(0, limit);
  }
}

export const notificationService = new NotificationService();

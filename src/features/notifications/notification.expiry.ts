import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';
import { logger } from '../../lib/logger';
import { notificationService } from './notification.service';
import { authService } from '../auth/auth.service';

export class NotificationExpiryService {
  private checkInterval: NodeJS.Timeout | null = null;

  async runExpiryCheck(): Promise<{ expiredCount: number; warnedCount: number }> {
    const client = getSafePgClient();
    if (!client) {
      return this.runExpiryCheckInMemory();
    }

    let expiredCount = 0;
    let warnedCount = 0;

    try {
      await client.connect();
      const usersRes = await client.query(
        `SELECT u."id", u."name", u."email", u."role", u."premiumExpiresAt", u."currentPlanId",
                p."name" as "planName"
         FROM "users" u
         LEFT JOIN "plans" p ON p."id" = u."currentPlanId"
         WHERE u."role" = 'PREMIUM' AND u."premiumExpiresAt" IS NOT NULL AND u."deletedAt" IS NULL`
      );

      const now = Date.now();
      for (const u of usersRes.rows) {
        const expiryMs = new Date(u.premiumExpiresAt).getTime();
        const diffMs = expiryMs - now;
        const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        const planDisplayName = u.planName || u.currentPlanId?.replace(/^plan-/, '').toUpperCase() || 'Premium';

        if (diffMs <= 0) {
          // 1. Expired - revert to FREE
          await client.query(
            `UPDATE "users" SET "role" = 'FREE', "currentPlanId" = NULL, "updatedAt" = NOW() WHERE "id" = $1`,
            [u.id]
          );
          await notificationService.createNotification({
            scope: 'USER',
            userId: u.id,
            type: 'PREMIUM_EXPIRED',
            title: 'Paket Berakhir',
            message: 'Paket Premium Anda telah berakhir. Upgrade kembali untuk melanjutkan akses tanpa batas.',
            link: '/harga',
          });
          expiredCount++;
        } else if (diffDays <= 3) {
          // 2. Expiring soon - check if warned in last 7 days
          const recentWarning = await client.query(
            `SELECT "id" FROM "notifications"
             WHERE "userId" = $1 AND "type" = 'PREMIUM_EXPIRING_SOON'
               AND "createdAt" >= NOW() - INTERVAL '7 days' AND "deletedAt" IS NULL
             LIMIT 1`,
            [u.id]
          );

          if (recentWarning.rows.length === 0) {
            await notificationService.createNotification({
              scope: 'USER',
              userId: u.id,
              type: 'PREMIUM_EXPIRING_SOON',
              title: 'Masa Aktif Segera Berakhir',
              message: `Paket ${planDisplayName} Anda akan berakhir dalam ${diffDays} hari. Perpanjang sekarang agar tidak kehilangan akses.`,
              link: '/harga',
            });
            warnedCount++;
          }
        }
      }
    } catch (err: any) {
      markDatabaseOffline(err);
      return this.runExpiryCheckInMemory();
    } finally {
      await client.end().catch(() => null);
    }

    return { expiredCount, warnedCount };
  }

  private async runExpiryCheckInMemory(): Promise<{ expiredCount: number; warnedCount: number }> {
    let expiredCount = 0;
    let warnedCount = 0;

    try {
      const users = authService.getUsers();
      const now = Date.now();

      for (const u of users) {
        if (u.role === 'PREMIUM' && u.premiumExpiresAt && !u.deletedAt) {
          const expiryMs = new Date(u.premiumExpiresAt).getTime();
          const diffMs = expiryMs - now;
          const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          const planDisplayName = u.currentPlanName || 'Premium';

          if (diffMs <= 0) {
            await authService.updateUser(u.id, { role: 'FREE', currentPlanId: null });
            await notificationService.createNotification({
              scope: 'USER',
              userId: u.id,
              type: 'PREMIUM_EXPIRED',
              title: 'Paket Berakhir',
              message: 'Paket Premium Anda telah berakhir. Upgrade kembali untuk melanjutkan akses tanpa batas.',
              link: '/harga',
            });
            expiredCount++;
          } else if (diffDays <= 3) {
            const notifs = await notificationService.getUserNotifications(u.id, 10, 0);
            const hasRecentWarn = notifs.items.some(
              (n) =>
                n.type === 'PREMIUM_EXPIRING_SOON' &&
                Date.now() - new Date(n.createdAt).getTime() < 7 * 24 * 3600 * 1000
            );

            if (!hasRecentWarn) {
              await notificationService.createNotification({
                scope: 'USER',
                userId: u.id,
                type: 'PREMIUM_EXPIRING_SOON',
                title: 'Masa Aktif Segera Berakhir',
                message: `Paket ${planDisplayName} Anda akan berakhir dalam ${diffDays} hari. Perpanjang sekarang agar tidak kehilangan akses.`,
                link: '/harga',
              });
              warnedCount++;
            }
          }
        }
      }
    } catch {
      // Memory fallback completed safely
    }

    return { expiredCount, warnedCount };
  }

  startScheduledJob(intervalMs = 30 * 60 * 1000): void {
    if (this.checkInterval) return;
    logger.info('[NotificationExpiryService] Starting subscription expiry monitor');
    // Run initial check with a slight delay
    setTimeout(() => this.runExpiryCheck().catch(() => null), 10000);
    this.checkInterval = setInterval(() => {
      this.runExpiryCheck().catch(() => null);
    }, intervalMs);
  }

  stopScheduledJob(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const notificationExpiryService = new NotificationExpiryService();

import { prisma } from '../../lib/prisma';

export interface RetentionInfo {
  isSubjectToAutoDeletion: boolean;
  daysRemaining: number | null;
  autoDeleteDate: string | null;
  isExpiringSoon: boolean; // 1-2 days before deletion
}

export class DashboardRetentionService {
  private static instance: DashboardRetentionService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  public static getInstance(): DashboardRetentionService {
    if (!DashboardRetentionService.instance) {
      DashboardRetentionService.instance = new DashboardRetentionService();
    }
    return DashboardRetentionService.instance;
  }

  /**
   * Initializes periodic scheduled cleanup job
   */
  public startScheduledCleanup(intervalMs: number = 60 * 60 * 1000): void {
    if (this.cleanupInterval) return;
    // Initial run on boot
    this.runCleanupJob().catch((err) =>
      console.warn('[RetentionService] Initial cleanup error:', err)
    );

    // Periodic scheduled job (default: hourly)
    this.cleanupInterval = setInterval(() => {
      this.runCleanupJob().catch((err) =>
        console.warn('[RetentionService] Scheduled cleanup error:', err)
      );
    }, intervalMs);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  public stopScheduledCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Executes database-wide retention cleanup:
   * 1. FREE Plan Users: Permanently purges active dashboards created > 7 days ago.
   * 2. ALL Users: Permanently purges soft-deleted dashboards deleted > 7 days ago from Trash.
   */
  public async runCleanupJob(): Promise<{ purgedFreeCount: number; purgedTrashCount: number }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let purgedFreeCount = 0;
    let purgedTrashCount = 0;

    try {
      if (!prisma?.dashboard) return { purgedFreeCount, purgedTrashCount };

      // 1. Purge expired trash dashboards (> 7 days since deletedAt) for ALL users
      const expiredTrash = await prisma.dashboard.findMany({
        where: {
          deletedAt: {
            not: null,
            lt: sevenDaysAgo,
          },
        },
        select: { id: true },
        includeDeleted: true,
      } as any);

      if (expiredTrash.length > 0) {
        const trashIds = expiredTrash.map((d: any) => d.id);
        // Direct delete/purge from database
        await prisma.dashboard.deleteMany({
          where: { id: { in: trashIds } },
          includeDeleted: true,
        } as any);
        purgedTrashCount = trashIds.length;
        console.log(`[RetentionService] Purged ${purgedTrashCount} expired trash dashboards (> 7 days in trash)`);
      }

      // 2. Purge expired active dashboards (> 7 days since createdAt) for FREE plan users ONLY
      const expiredFreeDashboards = await prisma.dashboard.findMany({
        where: {
          createdAt: { lt: sevenDaysAgo },
          dataset: {
            user: {
              role: {
                notIn: ['PREMIUM', 'SUPERADMIN'],
              },
            },
          },
        },
        select: { id: true },
        includeDeleted: true,
      } as any);

      if (expiredFreeDashboards.length > 0) {
        const freeIds = expiredFreeDashboards.map((d: any) => d.id);
        await prisma.dashboard.deleteMany({
          where: { id: { in: freeIds } },
          includeDeleted: true,
        } as any);
        purgedFreeCount = freeIds.length;
        console.log(`[RetentionService] Purged ${purgedFreeCount} expired FREE tier dashboards (> 7 days old)`);
      }
    } catch (err) {
      console.warn('[RetentionService] Cleanup error:', err);
    }

    return { purgedFreeCount, purgedTrashCount };
  }

  /**
   * Calculates dynamic retention metadata for a single dashboard
   */
  public calculateRetention(
    dashboardCreatedAt: string | Date,
    userRole: string = 'FREE'
  ): RetentionInfo {
    const isPremium = userRole.toUpperCase() === 'PREMIUM' || userRole.toUpperCase() === 'SUPERADMIN';
    if (isPremium) {
      return {
        isSubjectToAutoDeletion: false,
        daysRemaining: null,
        autoDeleteDate: null,
        isExpiringSoon: false,
      };
    }

    const createdTime = new Date(dashboardCreatedAt).getTime();
    const expireTime = createdTime + 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diffMs = expireTime - now;

    if (diffMs <= 0) {
      return {
        isSubjectToAutoDeletion: true,
        daysRemaining: 0,
        autoDeleteDate: new Date(expireTime).toISOString(),
        isExpiringSoon: true,
      };
    }

    const daysRemaining = Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    const isExpiringSoon = daysRemaining <= 2;

    return {
      isSubjectToAutoDeletion: true,
      daysRemaining,
      autoDeleteDate: new Date(expireTime).toISOString(),
      isExpiringSoon,
    };
  }

  /**
   * Calculates trash recovery retention (7 days from deletedAt)
   */
  public calculateTrashRetention(deletedAt: string | Date): {
    daysRemaining: number;
    autoDeleteDate: string;
  } {
    const deletedTime = new Date(deletedAt).getTime();
    const purgeTime = deletedTime + 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diffMs = purgeTime - now;
    const daysRemaining = Math.max(1, Math.ceil(Math.max(0, diffMs) / (24 * 60 * 60 * 1000)));

    return {
      daysRemaining,
      autoDeleteDate: new Date(purgeTime).toISOString(),
    };
  }
}

export const retentionService = DashboardRetentionService.getInstance();

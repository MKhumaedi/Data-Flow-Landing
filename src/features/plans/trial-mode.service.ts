import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { logAdminAction } from '../admin/audit-log/audit.helper';

export interface GlobalTrialModeRecord {
  id: string;
  isActive: boolean;
  label: string | null;
  startAt: Date | string | null;
  endAt: Date | string | null;
  updatedBy: string | null;
  updatedAt: Date | string;
}

export interface GlobalTrialStatusResponse {
  id: string | null;
  isActive: boolean;
  isCurrentlyActive: boolean;
  label: string | null;
  startAt: string | null;
  endAt: string | null;
  timeRemainingSeconds: number | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export class TrialModeService {
  // Ultra-lightweight in-memory cache to guarantee sub-millisecond lookups
  // without adding latency to high-frequency limit & role checks across the app
  private cachedRecord: GlobalTrialModeRecord | null = null;
  private cachedAt = 0;
  private readonly CACHE_TTL_MS = 3000; // 3 seconds TTL for automatic freshness

  /**
   * Evaluates if a trial record is currently active based on current time
   */
  private checkIsCurrentlyActive(record: GlobalTrialModeRecord | null): boolean {
    if (!record || !record.isActive) return false;
    const now = Date.now();
    if (record.startAt) {
      const startMs = new Date(record.startAt).getTime();
      if (!isNaN(startMs) && startMs > now) return false;
    }
    if (record.endAt) {
      const endMs = new Date(record.endAt).getTime();
      if (!isNaN(endMs) && endMs <= now) return false;
    }
    return true;
  }

  /**
   * Fetches the singleton GlobalTrialMode row with in-memory caching
   */
  async getRecord(): Promise<GlobalTrialModeRecord | null> {
    const now = Date.now();
    if (this.cachedRecord !== null && now - this.cachedAt < this.CACHE_TTL_MS) {
      return this.cachedRecord;
    }

    try {
      if ((prisma as any)?.globalTrialMode?.findFirst) {
        const record = await (prisma as any).globalTrialMode.findFirst({
          orderBy: { updatedAt: 'desc' },
        });
        if (record) {
          this.cachedRecord = record;
          this.cachedAt = now;
          return record;
        }
      }
    } catch (err: any) {
      logger.warn(`[TrialModeService] DB fetch failed: ${err?.message || err}`);
    }

    return this.cachedRecord;
  }

  /**
   * Fast real-time check whether Global Free Trial is currently active
   */
  async isTrialActive(): Promise<boolean> {
    const record = await this.getRecord();
    return this.checkIsCurrentlyActive(record);
  }

  /**
   * Detailed status response for Admin and Public banner
   */
  async getTrialModeStatus(): Promise<GlobalTrialStatusResponse> {
    const record = await this.getRecord();
    const isCurrentlyActive = this.checkIsCurrentlyActive(record);

    let timeRemainingSeconds: number | null = null;
    if (isCurrentlyActive && record?.endAt) {
      const diffMs = new Date(record.endAt).getTime() - Date.now();
      timeRemainingSeconds = diffMs > 0 ? Math.floor(diffMs / 1000) : 0;
    }

    return {
      id: record?.id || null,
      isActive: Boolean(record?.isActive),
      isCurrentlyActive,
      label: record?.label || null,
      startAt: record?.startAt ? new Date(record.startAt).toISOString() : null,
      endAt: record?.endAt ? new Date(record.endAt).toISOString() : null,
      timeRemainingSeconds,
      updatedBy: record?.updatedBy || null,
      updatedAt: record?.updatedAt ? new Date(record.updatedAt).toISOString() : null,
    };
  }

  /**
   * Activates Global Trial Mode with specified duration and reference label
   */
  async activateTrialMode(params: {
    label?: string | null;
    startAt?: Date | string | null;
    endAt: Date | string;
    adminId: string;
    adminEmail?: string;
  }): Promise<GlobalTrialStatusResponse> {
    const startAt = params.startAt ? new Date(params.startAt) : new Date();
    const endAt = new Date(params.endAt);
    const label = params.label?.trim() || null;
    const now = new Date();

    if (isNaN(endAt.getTime()) || endAt.getTime() <= startAt.getTime()) {
      throw {
        statusCode: 400,
        code: 'INVALID_DURATION',
        message: 'Waktu berakhir harus lebih besar dari waktu mulai.',
      };
    }

    let savedRecord: GlobalTrialModeRecord;

    try {
      const existing = (prisma as any)?.globalTrialMode?.findFirst
        ? await (prisma as any).globalTrialMode.findFirst()
        : null;

      if (existing && (prisma as any)?.globalTrialMode?.update) {
        savedRecord = await (prisma as any).globalTrialMode.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            label,
            startAt,
            endAt,
            updatedBy: params.adminEmail || params.adminId,
            updatedAt: now,
          },
        });
      } else if ((prisma as any)?.globalTrialMode?.create) {
        savedRecord = await (prisma as any).globalTrialMode.create({
          data: {
            isActive: true,
            label,
            startAt,
            endAt,
            updatedBy: params.adminEmail || params.adminId,
            updatedAt: now,
          },
        });
      } else {
        savedRecord = {
          id: 'trial-mode-singleton',
          isActive: true,
          label,
          startAt,
          endAt,
          updatedBy: params.adminEmail || params.adminId,
          updatedAt: now,
        };
      }
    } catch (err: any) {
      logger.error(`[TrialModeService] Failed to activate trial mode in DB: ${err?.message}`);
      savedRecord = {
        id: 'trial-mode-singleton',
        isActive: true,
        label,
        startAt,
        endAt,
        updatedBy: params.adminEmail || params.adminId,
        updatedAt: now,
      };
    }

    // Invalidate and immediately prime in-memory cache for instant real-time effect
    this.cachedRecord = savedRecord;
    this.cachedAt = Date.now();

    // Log high-impact action to security audit log
    await logAdminAction({
      adminId: params.adminId,
      adminEmail: params.adminEmail || 'admin@maystudio.app',
      action: 'GLOBAL_TRIAL_ACTIVATED',
      targetType: 'GLOBAL_TRIAL_MODE',
      targetId: savedRecord.id,
      details: {
        label: savedRecord.label,
        startAt: savedRecord.startAt,
        endAt: savedRecord.endAt,
        activatedAt: now.toISOString(),
        impact: 'Full PREMIUM access granted to all users site-wide (excluding AI CV Match)',
      },
    });

    logger.info(`[TrialMode] Activated by ${params.adminEmail || params.adminId} until ${endAt.toISOString()}`);
    return this.getTrialModeStatus();
  }

  /**
   * Deactivates Global Trial Mode immediately (manual override)
   */
  async deactivateTrialMode(params: {
    adminId: string;
    adminEmail?: string;
  }): Promise<GlobalTrialStatusResponse> {
    const now = new Date();
    let updatedRecord: GlobalTrialModeRecord;

    try {
      const existing = (prisma as any)?.globalTrialMode?.findFirst
        ? await (prisma as any).globalTrialMode.findFirst()
        : null;

      if (existing && (prisma as any)?.globalTrialMode?.update) {
        updatedRecord = await (prisma as any).globalTrialMode.update({
          where: { id: existing.id },
          data: {
            isActive: false,
            updatedBy: params.adminEmail || params.adminId,
            updatedAt: now,
          },
        });
      } else {
        updatedRecord = {
          id: existing?.id || 'trial-mode-singleton',
          isActive: false,
          label: existing?.label || null,
          startAt: existing?.startAt || null,
          endAt: existing?.endAt || null,
          updatedBy: params.adminEmail || params.adminId,
          updatedAt: now,
        };
      }
    } catch (err: any) {
      logger.error(`[TrialModeService] Failed to deactivate trial mode in DB: ${err?.message}`);
      updatedRecord = {
        id: 'trial-mode-singleton',
        isActive: false,
        label: this.cachedRecord?.label || null,
        startAt: this.cachedRecord?.startAt || null,
        endAt: this.cachedRecord?.endAt || null,
        updatedBy: params.adminEmail || params.adminId,
        updatedAt: now,
      };
    }

    // Immediately prime cache with deactivated state
    this.cachedRecord = updatedRecord;
    this.cachedAt = Date.now();

    // Log deactivation to security audit log
    await logAdminAction({
      adminId: params.adminId,
      adminEmail: params.adminEmail || 'admin@maystudio.app',
      action: 'GLOBAL_TRIAL_DEACTIVATED',
      targetType: 'GLOBAL_TRIAL_MODE',
      targetId: updatedRecord.id,
      details: {
        deactivatedAt: now.toISOString(),
        previousLabel: updatedRecord.label,
        previousEndAt: updatedRecord.endAt,
        impact: 'Access site-wide reverted to standard individual user plan limits',
      },
    });

    logger.info(`[TrialMode] Deactivated by ${params.adminEmail || params.adminId}`);
    return this.getTrialModeStatus();
  }
}

export const trialModeService = new TrialModeService();

import { Client } from 'pg';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';
import {
  SiteIntegrationDto,
  SiteIntegrationRecord,
  PublicSiteIntegration,
} from './site-settings.types';

export class SiteSettingsService {
  private inMemoryRecord: SiteIntegrationRecord | null = null;
  private tableEnsured = false;

  private async getPgClient(): Promise<Client | null> {
    const client = getSafePgClient();
    if (!client) return null;
    try {
      await client.connect();
      return client;
    } catch (err: any) {
      markDatabaseOffline(err);
      return null;
    }
  }

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    const client = await this.getPgClient();
    if (!client) return;
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "site_integrations" (
          "id" TEXT NOT NULL,
          "gtmContainerId" TEXT,
          "ga4MeasurementId" TEXT,
          "gscVerificationCode" TEXT,
          "customHeadScript" TEXT,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedBy" TEXT,
          CONSTRAINT "site_integrations_pkey" PRIMARY KEY ("id")
        );
      `);
      this.tableEnsured = true;
    } catch (err: any) {
      logger.warn(`[SiteSettingsService] ensureTable warning: ${err.message}`);
    } finally {
      await client.end().catch(() => {});
    }
  }

  private cleanValue(val?: string | null): string | null {
    if (!val) return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  async getIntegrationSettings(): Promise<SiteIntegrationRecord | null> {
    await this.ensureTable();
    try {
      if ((prisma as any)?.siteIntegration?.findFirst) {
        const record = await (prisma as any).siteIntegration.findFirst({
          orderBy: { updatedAt: 'desc' },
        });
        if (record) {
          this.inMemoryRecord = record;
          return record;
        }
      } else {
        const client = await this.getPgClient();
        if (client) {
          try {
            const res = await client.query(`SELECT * FROM "site_integrations" ORDER BY "updatedAt" DESC LIMIT 1`);
            if (res.rows && res.rows[0]) {
              this.inMemoryRecord = res.rows[0] as SiteIntegrationRecord;
              return this.inMemoryRecord;
            }
          } finally {
            await client.end().catch(() => {});
          }
        }
      }
    } catch (err: any) {
      logger.warn(`[SiteSettingsService] findFirst query failed: ${err.message}`);
    }
    return this.inMemoryRecord;
  }

  async getPublicSettings(): Promise<PublicSiteIntegration> {
    const record = await this.getIntegrationSettings();
    return {
      gtmContainerId: record?.gtmContainerId || null,
      ga4MeasurementId: record?.ga4MeasurementId || null,
      gscVerificationCode: record?.gscVerificationCode || null,
      customHeadScript: record?.customHeadScript || null,
    };
  }

  async upsertIntegrationSettings(
    dto: SiteIntegrationDto,
    admin: { id: string; email?: string }
  ): Promise<SiteIntegrationRecord> {
    await this.ensureTable();
    const cleaned = {
      gtmContainerId: this.cleanValue(dto.gtmContainerId),
      ga4MeasurementId: this.cleanValue(dto.ga4MeasurementId),
      gscVerificationCode: this.cleanValue(dto.gscVerificationCode),
      customHeadScript: this.cleanValue(dto.customHeadScript),
      updatedBy: admin.email || admin.id,
      updatedAt: new Date(),
    };

    let resultRecord: SiteIntegrationRecord;
    const existing = await this.getIntegrationSettings();

    if ((prisma as any)?.siteIntegration?.update && (prisma as any)?.siteIntegration?.create) {
      if (existing?.id) {
        resultRecord = await (prisma as any).siteIntegration.update({
          where: { id: existing.id },
          data: cleaned,
        });
      } else {
        resultRecord = await (prisma as any).siteIntegration.create({
          data: { id: 'default-integration-settings', ...cleaned },
        });
      }
    } else {
      const client = await this.getPgClient();
      const id = existing?.id || 'default-integration-settings';
      if (client) {
        try {
          const query = `
            INSERT INTO "site_integrations" ("id", "gtmContainerId", "ga4MeasurementId", "gscVerificationCode", "customHeadScript", "updatedBy", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT ("id") DO UPDATE SET
              "gtmContainerId" = EXCLUDED."gtmContainerId",
              "ga4MeasurementId" = EXCLUDED."ga4MeasurementId",
              "gscVerificationCode" = EXCLUDED."gscVerificationCode",
              "customHeadScript" = EXCLUDED."customHeadScript",
              "updatedBy" = EXCLUDED."updatedBy",
              "updatedAt" = EXCLUDED."updatedAt"
            RETURNING *;
          `;
          const res = await client.query(query, [
            id,
            cleaned.gtmContainerId,
            cleaned.ga4MeasurementId,
            cleaned.gscVerificationCode,
            cleaned.customHeadScript,
            cleaned.updatedBy,
            cleaned.updatedAt,
          ]);
          resultRecord = (res.rows?.[0] as SiteIntegrationRecord) || { id, ...cleaned };
        } finally {
          await client.end().catch(() => {});
        }
      } else {
        resultRecord = { id, ...cleaned };
      }
    }

    this.inMemoryRecord = resultRecord;
    await this.recordAuditLog(resultRecord, cleaned, admin);
    return resultRecord;
  }

  private async recordAuditLog(
    record: SiteIntegrationRecord,
    cleaned: SiteIntegrationDto,
    admin: { id: string; email?: string }
  ): Promise<void> {
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email || 'admin@maystudio.app',
      action: 'UPDATE_SITE_INTEGRATIONS',
      targetType: 'SITE_INTEGRATION',
      targetId: record.id,
      details: {
        gtmContainerId: cleaned.gtmContainerId,
        ga4MeasurementId: cleaned.ga4MeasurementId,
        gscVerificationCode: cleaned.gscVerificationCode,
        hasCustomHeadScript: Boolean(cleaned.customHeadScript),
      },
    });
  }
}

export const siteSettingsService = new SiteSettingsService();

import { Client } from 'pg';
import { PlanItem, PlanPricingItem, CreatePlanDto, UpdatePlanDto, CreatePlanPricingDto, UpdatePlanPricingDto, UserPlanLimits } from './plan.types';
import { INITIAL_PLAN_SEEDS } from './plan.seed';
import { mapPlanRow, mapPricingRow, slugify } from './plan.helper';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { authService } from '../auth/auth.service';
import { trialModeService } from './trial-mode.service';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

class PlanService {
  private inMemoryPlans: PlanItem[] = JSON.parse(JSON.stringify(INITIAL_PLAN_SEEDS));
  private isInitialized = false;

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  private async ensureSchemaAndSeeds(client: Client): Promise<void> {
    if (this.isInitialized) return;
    try {
      await client.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "premiumExpiresAt" TIMESTAMP(3);
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "currentPlanId" TEXT;

        CREATE TABLE IF NOT EXISTS "plans" (
          "id" TEXT PRIMARY KEY,
          "slug" TEXT UNIQUE NOT NULL,
          "name" TEXT NOT NULL,
          "tagline" TEXT,
          "badge" TEXT,
          "accentColor" TEXT NOT NULL DEFAULT '#00685f',
          "features" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "dashboardLimit" INTEGER,
          "templateAccessLimit" INTEGER,
          "isFree" BOOLEAN NOT NULL DEFAULT false,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "order" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP(3)
        );

        ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "dashboardLimit" INTEGER;
        ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "templateAccessLimit" INTEGER;

        -- Ensure Free plan has default limits
        UPDATE "plans" SET "dashboardLimit" = 1, "templateAccessLimit" = 2 WHERE "slug" = 'free' AND ("dashboardLimit" IS NULL OR "dashboardLimit" = 3);

        CREATE TABLE IF NOT EXISTS "plan_pricings" (
          "id" TEXT PRIMARY KEY,
          "planId" TEXT NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
          "durationLabel" TEXT NOT NULL,
          "durationDays" INTEGER NOT NULL,
          "normalPrice" DECIMAL(12,2) NOT NULL,
          "discountPrice" DECIMAL(12,2),
          "isBestValue" BOOLEAN NOT NULL DEFAULT false,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "order" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP(3)
        );

        CREATE TABLE IF NOT EXISTS "transactions" (
          "id" TEXT PRIMARY KEY,
          "reference" TEXT UNIQUE NOT NULL,
          "merchantRef" TEXT UNIQUE NOT NULL,
          "userId" TEXT,
          "userEmail" TEXT NOT NULL,
          "userName" TEXT,
          "amount" DECIMAL(12,2) NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'IDR',
          "paymentMethod" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'UNPAID',
          "planId" TEXT,
          "planPricingId" TEXT,
          "planName" TEXT,
          "durationDays" INTEGER,
          "paidAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "deletedAt" TIMESTAMP(3)
        );
      `);

      const countRes = await client.query('SELECT COUNT(*) FROM "plans" WHERE "deletedAt" IS NULL');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        for (const plan of INITIAL_PLAN_SEEDS) {
          await client.query(
            `INSERT INTO "plans" ("id", "slug", "name", "tagline", "badge", "accentColor", "features", "dashboardLimit", "templateAccessLimit", "isFree", "isActive", "order", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
             ON CONFLICT ("slug") DO NOTHING`,
            [plan.id, plan.slug, plan.name, plan.tagline, plan.badge, plan.accentColor, JSON.stringify(plan.features), plan.dashboardLimit ?? null, plan.templateAccessLimit ?? null, plan.isFree, plan.isActive, plan.order]
          );

          for (const opt of plan.pricingOptions) {
            await client.query(
              `INSERT INTO "plan_pricings" ("id", "planId", "durationLabel", "durationDays", "normalPrice", "discountPrice", "isBestValue", "isActive", "order", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
               ON CONFLICT ("id") DO NOTHING`,
              [opt.id, opt.planId, opt.durationLabel, opt.durationDays, opt.normalPrice, opt.discountPrice, opt.isBestValue, opt.isActive, opt.order]
            );
          }
        }
      }
      this.isInitialized = true;
    } catch (err: any) {
      logger.warn(`[PlanService] Schema check warning: ${err.message}`);
    }
  }

  async listActive(): Promise<PlanItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        const plansRes = await client.query(
          `SELECT * FROM "plans" WHERE "isActive" = true AND "deletedAt" IS NULL ORDER BY "order" ASC, "createdAt" ASC`
        );
        const pricingsRes = await client.query(
          `SELECT * FROM "plan_pricings" WHERE "isActive" = true AND "deletedAt" IS NULL ORDER BY "order" ASC, "createdAt" ASC`
        );
        const allPricings = pricingsRes.rows.map(mapPricingRow);
        return plansRes.rows.map((row) => {
          const opts = allPricings.filter((p) => p.planId === row.id);
          return mapPlanRow(row, opts);
        });
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }

    return this.inMemoryPlans
      .filter((p) => p.isActive && !p.deletedAt)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        ...p,
        pricingOptions: (p.pricingOptions || [])
          .filter((opt) => opt.isActive && !opt.deletedAt)
          .sort((a, b) => a.order - b.order),
      }));
  }

  async listAll(includeArchived = false): Promise<PlanItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        const whereClause = includeArchived ? '' : 'WHERE "deletedAt" IS NULL';
        const plansRes = await client.query(
          `SELECT * FROM "plans" ${whereClause} ORDER BY "order" ASC, "createdAt" ASC`
        );
        const pricingsRes = await client.query(
          `SELECT * FROM "plan_pricings" WHERE "deletedAt" IS NULL ORDER BY "order" ASC, "createdAt" ASC`
        );
        const allPricings = pricingsRes.rows.map(mapPricingRow);
        return plansRes.rows.map((row) => {
          const opts = allPricings.filter((p) => p.planId === row.id);
          return mapPlanRow(row, opts);
        });
      } catch (err: any) {
        logger.warn(`[PlanService] listAll fallback to memory: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    return this.inMemoryPlans
      .filter((p) => includeArchived || !p.deletedAt)
      .sort((a, b) => a.order - b.order);
  }

  async getById(id: string): Promise<PlanItem | null> {
    const all = await this.listAll(true);
    const normalized = (id || '').trim().toLowerCase();
    const exact = all.find(
      (p) =>
        p.id.toLowerCase() === normalized ||
        p.slug.toLowerCase() === normalized ||
        p.name.toLowerCase() === normalized
    );
    if (exact) return exact;

    // Handle common alias: 'pro' -> 'premium'
    if (normalized === 'pro') {
      return all.find((p) => p.slug === 'premium' || p.id === 'plan-premium') || null;
    }

    return null;
  }

  async create(dto: CreatePlanDto, adminUser?: any): Promise<PlanItem> {
    const planId = 'plan-' + Math.random().toString(36).substring(2, 9);
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const order = dto.order ?? 0;
    const isFree = Boolean(dto.isFree);
    const isActive = dto.isActive !== undefined ? dto.isActive : true;
    const accentColor = dto.accentColor || '#00685f';
    const features = dto.features || [];

    const dashboardLimit = dto.dashboardLimit !== undefined ? dto.dashboardLimit : (isFree ? 1 : null);
    const templateAccessLimit = dto.templateAccessLimit !== undefined ? dto.templateAccessLimit : (isFree ? 2 : null);

    const newPlan: PlanItem = {
      id: planId,
      slug,
      name: dto.name,
      tagline: dto.tagline || null,
      badge: dto.badge || null,
      accentColor,
      features,
      dashboardLimit,
      templateAccessLimit,
      isFree,
      isActive,
      order,
      pricingOptions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    if (dto.pricingOptions && dto.pricingOptions.length > 0) {
      newPlan.pricingOptions = dto.pricingOptions.map((opt, idx) => ({
        id: 'pricing-' + Math.random().toString(36).substring(2, 9),
        planId,
        durationLabel: opt.durationLabel,
        durationDays: opt.durationDays,
        normalPrice: opt.normalPrice,
        discountPrice: opt.discountPrice || null,
        isBestValue: Boolean(opt.isBestValue),
        isActive: opt.isActive !== undefined ? opt.isActive : true,
        order: opt.order ?? idx + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
    }

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        await client.query(
          `INSERT INTO "plans" ("id", "slug", "name", "tagline", "badge", "accentColor", "features", "dashboardLimit", "templateAccessLimit", "isFree", "isActive", "order", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())`,
          [newPlan.id, newPlan.slug, newPlan.name, newPlan.tagline, newPlan.badge, newPlan.accentColor, JSON.stringify(newPlan.features), newPlan.dashboardLimit ?? null, newPlan.templateAccessLimit ?? null, newPlan.isFree, newPlan.isActive, newPlan.order]
        );

        for (const opt of newPlan.pricingOptions) {
          await client.query(
            `INSERT INTO "plan_pricings" ("id", "planId", "durationLabel", "durationDays", "normalPrice", "discountPrice", "isBestValue", "isActive", "order", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
            [opt.id, opt.planId, opt.durationLabel, opt.durationDays, opt.normalPrice, opt.discountPrice, opt.isBestValue, opt.isActive, opt.order]
          );
        }
      } catch (err: any) {
        logger.warn(`[PlanService] create DB insert warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    this.inMemoryPlans.push(newPlan);

    await logAdminAction({
      adminId: adminUser?.id || adminUser?.userId || 'admin',
      adminEmail: adminUser?.email || 'admin@maystudio.id',
      action: 'PLAN_CREATED',
      targetType: 'PLAN',
      targetId: newPlan.id,
      details: { name: newPlan.name, slug: newPlan.slug, isFree: newPlan.isFree },
    });

    return newPlan;
  }

  async update(id: string, dto: UpdatePlanDto, adminUser?: any): Promise<PlanItem> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Paket tidak ditemukan');

    const updatedPlan: PlanItem = {
      ...existing,
      name: dto.name ?? existing.name,
      slug: dto.slug ? slugify(dto.slug) : existing.slug,
      tagline: dto.tagline !== undefined ? dto.tagline : existing.tagline,
      badge: dto.badge !== undefined ? dto.badge : existing.badge,
      accentColor: dto.accentColor ?? existing.accentColor,
      features: dto.features ?? existing.features,
      dashboardLimit: dto.dashboardLimit !== undefined ? dto.dashboardLimit : existing.dashboardLimit,
      templateAccessLimit: dto.templateAccessLimit !== undefined ? dto.templateAccessLimit : existing.templateAccessLimit,
      isFree: dto.isFree !== undefined ? dto.isFree : existing.isFree,
      isActive: dto.isActive !== undefined ? dto.isActive : existing.isActive,
      order: dto.order !== undefined ? dto.order : existing.order,
      updatedAt: new Date().toISOString(),
    };

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        await client.query(
          `UPDATE "plans" SET
            "name" = $1, "slug" = $2, "tagline" = $3, "badge" = $4, "accentColor" = $5,
            "features" = $6, "dashboardLimit" = $7, "templateAccessLimit" = $8, "isFree" = $9, "isActive" = $10, "order" = $11, "updatedAt" = NOW()
           WHERE "id" = $12`,
          [updatedPlan.name, updatedPlan.slug, updatedPlan.tagline, updatedPlan.badge, updatedPlan.accentColor, JSON.stringify(updatedPlan.features), updatedPlan.dashboardLimit ?? null, updatedPlan.templateAccessLimit ?? null, updatedPlan.isFree, updatedPlan.isActive, updatedPlan.order, id]
        );
      } catch (err: any) {
        logger.warn(`[PlanService] update DB warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const idx = this.inMemoryPlans.findIndex((p) => p.id === id);
    if (idx >= 0) this.inMemoryPlans[idx] = updatedPlan;

    await logAdminAction({
      adminId: adminUser?.id || adminUser?.userId || 'admin',
      adminEmail: adminUser?.email || 'admin@maystudio.id',
      action: 'PLAN_UPDATED',
      targetType: 'PLAN',
      targetId: id,
      details: { name: updatedPlan.name, slug: updatedPlan.slug },
    });

    return updatedPlan;
  }

  async archive(id: string, adminUser?: any): Promise<void> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        await client.query(`UPDATE "plans" SET "deletedAt" = NOW() WHERE "id" = $1`, [id]);
      } catch (err: any) {
        logger.warn(`[PlanService] archive DB warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const item = this.inMemoryPlans.find((p) => p.id === id);
    if (item) item.deletedAt = new Date().toISOString();

    await logAdminAction({
      adminId: adminUser?.id || adminUser?.userId || 'admin',
      adminEmail: adminUser?.email || 'admin@maystudio.id',
      action: 'PLAN_ARCHIVED',
      targetType: 'PLAN',
      targetId: id,
      details: { planId: id },
    });
  }

  async restore(id: string, adminUser?: any): Promise<void> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        await client.query(`UPDATE "plans" SET "deletedAt" = NULL WHERE "id" = $1`, [id]);
      } catch (err: any) {
        logger.warn(`[PlanService] restore DB warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const item = this.inMemoryPlans.find((p) => p.id === id);
    if (item) item.deletedAt = null;

    await logAdminAction({
      adminId: adminUser?.id || adminUser?.userId || 'admin',
      adminEmail: adminUser?.email || 'admin@maystudio.id',
      action: 'PLAN_RESTORED',
      targetType: 'PLAN',
      targetId: id,
      details: { planId: id },
    });
  }

  async createPricing(planId: string, dto: CreatePlanPricingDto, adminUser?: any): Promise<PlanPricingItem> {
    const pricingId = 'pricing-' + Math.random().toString(36).substring(2, 9);
    const newPricing: PlanPricingItem = {
      id: pricingId,
      planId,
      durationLabel: dto.durationLabel,
      durationDays: dto.durationDays,
      normalPrice: dto.normalPrice,
      discountPrice: dto.discountPrice || null,
      isBestValue: Boolean(dto.isBestValue),
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      order: dto.order ?? 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        await client.query(
          `INSERT INTO "plan_pricings" ("id", "planId", "durationLabel", "durationDays", "normalPrice", "discountPrice", "isBestValue", "isActive", "order", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
          [newPricing.id, newPricing.planId, newPricing.durationLabel, newPricing.durationDays, newPricing.normalPrice, newPricing.discountPrice, newPricing.isBestValue, newPricing.isActive, newPricing.order]
        );
      } catch (err: any) {
        logger.warn(`[PlanService] createPricing DB warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const plan = this.inMemoryPlans.find((p) => p.id === planId);
    if (plan) {
      if (!plan.pricingOptions) plan.pricingOptions = [];
      plan.pricingOptions.push(newPricing);
    }

    await logAdminAction({
      adminId: adminUser?.id || adminUser?.userId || 'admin',
      adminEmail: adminUser?.email || 'admin@maystudio.id',
      action: 'PLAN_PRICING_CREATED',
      targetType: 'PLAN_PRICING',
      targetId: pricingId,
      details: { planId, durationLabel: dto.durationLabel, normalPrice: dto.normalPrice },
    });

    return newPricing;
  }

  async updatePricing(pricingId: string, dto: UpdatePlanPricingDto, adminUser?: any): Promise<PlanPricingItem> {
    const client = this.getPgClient();
    let updated: PlanPricingItem | null = null;

    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        const curRes = await client.query(`SELECT * FROM "plan_pricings" WHERE "id" = $1`, [pricingId]);
        if (curRes.rows.length > 0) {
          const cur = mapPricingRow(curRes.rows[0]);
          updated = {
            ...cur,
            durationLabel: dto.durationLabel ?? cur.durationLabel,
            durationDays: dto.durationDays ?? cur.durationDays,
            normalPrice: dto.normalPrice ?? cur.normalPrice,
            discountPrice: dto.discountPrice !== undefined ? dto.discountPrice : cur.discountPrice,
            isBestValue: dto.isBestValue !== undefined ? dto.isBestValue : cur.isBestValue,
            isActive: dto.isActive !== undefined ? dto.isActive : cur.isActive,
            order: dto.order !== undefined ? dto.order : cur.order,
            updatedAt: new Date().toISOString(),
          };

          await client.query(
            `UPDATE "plan_pricings" SET
              "durationLabel" = $1, "durationDays" = $2, "normalPrice" = $3, "discountPrice" = $4,
              "isBestValue" = $5, "isActive" = $6, "order" = $7, "updatedAt" = NOW()
             WHERE "id" = $8`,
            [updated.durationLabel, updated.durationDays, updated.normalPrice, updated.discountPrice, updated.isBestValue, updated.isActive, updated.order, pricingId]
          );
        }
      } catch (err: any) {
        logger.warn(`[PlanService] updatePricing DB warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    for (const plan of this.inMemoryPlans) {
      const pIdx = (plan.pricingOptions || []).findIndex((opt) => opt.id === pricingId);
      if (pIdx >= 0) {
        const cur = plan.pricingOptions[pIdx];
        const memUpdated = {
          ...cur,
          durationLabel: dto.durationLabel ?? cur.durationLabel,
          durationDays: dto.durationDays ?? cur.durationDays,
          normalPrice: dto.normalPrice ?? cur.normalPrice,
          discountPrice: dto.discountPrice !== undefined ? dto.discountPrice : cur.discountPrice,
          isBestValue: dto.isBestValue !== undefined ? dto.isBestValue : cur.isBestValue,
          isActive: dto.isActive !== undefined ? dto.isActive : cur.isActive,
          order: dto.order !== undefined ? dto.order : cur.order,
          updatedAt: new Date().toISOString(),
        };
        plan.pricingOptions[pIdx] = memUpdated;
        if (!updated) updated = memUpdated;
        break;
      }
    }

    if (!updated) throw new Error('Opsi durasi harga tidak ditemukan');

    await logAdminAction({
      adminId: adminUser?.id || adminUser?.userId || 'admin',
      adminEmail: adminUser?.email || 'admin@maystudio.id',
      action: 'PLAN_PRICING_UPDATED',
      targetType: 'PLAN_PRICING',
      targetId: pricingId,
      details: { pricingId, durationLabel: updated.durationLabel, normalPrice: updated.normalPrice },
    });

    return updated;
  }

  async deletePricing(pricingId: string, adminUser?: any): Promise<void> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSchemaAndSeeds(client);
        await client.query(`DELETE FROM "plan_pricings" WHERE "id" = $1`, [pricingId]);
      } catch (err: any) {
        logger.warn(`[PlanService] deletePricing DB warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    for (const plan of this.inMemoryPlans) {
      if (plan.pricingOptions) {
        plan.pricingOptions = plan.pricingOptions.filter((opt) => opt.id !== pricingId);
      }
    }

    await logAdminAction({
      adminId: adminUser?.id || adminUser?.userId || 'admin',
      adminEmail: adminUser?.email || 'admin@maystudio.id',
      action: 'PLAN_PRICING_DELETED',
      targetType: 'PLAN_PRICING',
      targetId: pricingId,
      details: { pricingId },
    });
  }

  async getUserPlanLimits(userId: string): Promise<UserPlanLimits> {
    try {
      // 1. Check Global Free Trial Mode FIRST
      // When active, grants ALL users (guests, FREE, etc.) full PREMIUM-equivalent limits
      const isTrialActive = await trialModeService.isTrialActive();
      if (isTrialActive) {
        const trialInfo = await trialModeService.getTrialModeStatus();
        let currentDashboardCount = 0;
        try {
          if (userId && prisma?.dashboard?.count) {
            currentDashboardCount = await prisma.dashboard.count({
              where: {
                dataset: { userId },
                deletedAt: null,
              },
            });
          }
        } catch {
          // in-memory fallback
        }

        return {
          userId,
          planId: 'plan-global-trial',
          planSlug: 'premium',
          planName: trialInfo.label || 'Mode Trial Global',
          isFree: false,
          isPremiumRole: true,
          dashboardLimit: null, // Unlimited dashboards
          templateAccessLimit: null, // All templates unlocked
          currentDashboardCount,
          canCreateDashboard: true,
          unlockedTemplateCount: null,
          isGlobalTrialActive: true,
          globalTrialLabel: trialInfo.label,
          globalTrialEndAt: trialInfo.endAt,
        };
      }

      const user = await authService.getUserById(userId).catch(() => null);
      if (!user) {
        return {
          userId,
          planId: 'plan-free',
          planSlug: 'free',
          planName: 'Free',
          isFree: true,
          isPremiumRole: false,
          dashboardLimit: 1,
          templateAccessLimit: 2,
          currentDashboardCount: 0,
          canCreateDashboard: true,
          unlockedTemplateCount: 2,
        };
      }

      const roleStr = (user.role || '').toUpperCase();
      const isSuperAdmin = roleStr === 'SUPERADMIN';
      const isPremiumRole = isSuperAdmin || roleStr === 'PREMIUM' || roleStr === 'PRO';

      // Count active (non-deleted) dashboards for this user
      let currentDashboardCount = 0;
      try {
        if (prisma?.dashboard?.count) {
          currentDashboardCount = await prisma.dashboard.count({
            where: {
              dataset: { userId },
              deletedAt: null,
            },
          });
        }
      } catch (err) {
        // In-memory or raw fallback
      }

      // If user is SUPERADMIN -> unlimited dashboards and all templates
      if (isSuperAdmin) {
        return {
          userId,
          planId: user.currentPlanId || 'plan-superadmin',
          planSlug: 'enterprise',
          planName: 'Super Admin',
          isFree: false,
          isPremiumRole: true,
          dashboardLimit: null,
          templateAccessLimit: null,
          currentDashboardCount,
          canCreateDashboard: true,
          unlockedTemplateCount: null,
        };
      }

      // Find all plans to resolve active plan
      const allPlans = await this.listAll(true);
      let matchedPlan: PlanItem | undefined;

      if (user.currentPlanId) {
        matchedPlan = allPlans.find((p) => p.id === user.currentPlanId);
      }

      if (!matchedPlan && user.plan) {
        const userPlanSlug = String(user.plan).toLowerCase();
        matchedPlan = allPlans.find(
          (p) =>
            p.slug.toLowerCase() === userPlanSlug ||
            (userPlanSlug === 'pro' && p.slug === 'premium') ||
            (userPlanSlug === 'enterprise' && p.slug === 'business')
        );
      }

      if (!matchedPlan && isPremiumRole) {
        matchedPlan = allPlans.find((p) => p.slug === 'premium' || p.slug === 'gold') || allPlans.find((p) => !p.isFree);
      }

      if (!matchedPlan) {
        matchedPlan = allPlans.find((p) => p.isFree || p.slug === 'free');
      }

      // Resolve limits
      const isFree = matchedPlan ? Boolean(matchedPlan.isFree) : !isPremiumRole;
      let dashboardLimit: number | null = null;
      let templateAccessLimit: number | null = null;

      if (matchedPlan) {
        dashboardLimit = matchedPlan.dashboardLimit !== undefined ? matchedPlan.dashboardLimit : (isFree ? 1 : null);
        templateAccessLimit = matchedPlan.templateAccessLimit !== undefined ? matchedPlan.templateAccessLimit : (isFree ? 2 : null);
      } else {
        dashboardLimit = isFree ? 1 : null;
        templateAccessLimit = isFree ? 2 : null;
      }

      const canCreateDashboard = dashboardLimit === null || currentDashboardCount < dashboardLimit;

      return {
        userId,
        planId: matchedPlan?.id || (isFree ? 'plan-free' : 'plan-premium'),
        planSlug: matchedPlan?.slug || (isFree ? 'free' : 'premium'),
        planName: matchedPlan?.name || (isFree ? 'Free' : 'Premium'),
        isFree,
        isPremiumRole,
        dashboardLimit,
        templateAccessLimit,
        currentDashboardCount,
        canCreateDashboard,
        unlockedTemplateCount: templateAccessLimit,
      };
    } catch (err: any) {
      logger.warn(`[PlanService] getUserPlanLimits error: ${err?.message}`);
      return {
        userId,
        planId: 'plan-free',
        planSlug: 'free',
        planName: 'Free',
        isFree: true,
        isPremiumRole: false,
        dashboardLimit: 1,
        templateAccessLimit: 2,
        currentDashboardCount: 0,
        canCreateDashboard: true,
        unlockedTemplateCount: 2,
      };
    }
  }
}

export const planService = new PlanService();
export const getUserPlanLimits = (userId: string) => planService.getUserPlanLimits(userId);

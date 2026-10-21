import type { Dashboard } from '../../types/shared';
import { prisma } from '../../lib/prisma';
import { ensurePrismaUser, ensurePrismaDataset, ensurePrismaTemplate } from '../../lib/db-helpers';
import { retentionService } from './retention.service';
import { getUserPlanLimits } from '../plans/plan.service';

class DashboardService {
  private dashboards: Map<string, Dashboard> = new Map();

  constructor() {
    // Seed initial executive dashboard
    const defaultDashId = 'dash-executive-q3';
    this.dashboards.set(defaultDashId, {
      id: defaultDashId,
      userId: 'usr-alex-chen',
      datasetId: 'ds-sample-financial',
      title: 'Executive Financial & Growth Overview',
      description: 'Konsolidasi performa finansial kuartal 3, distribusi pendapatan, dan tren profitabilitas.',
      themeId: 'minimal-teal',
      isPublic: true,
      publicId: 'share-exec-q3-2024',
      layout: {
        kpis: [
          { id: 'kpi-1', label: 'Total Pendapatan', columnName: 'Pendapatan', aggregation: 'sum', format: 'currency', trendPercentage: 14.8 },
          { id: 'kpi-2', label: 'Total Laba Bersih', columnName: 'Laba Bersih', aggregation: 'sum', format: 'currency', trendPercentage: 22.4 },
          { id: 'kpi-3', label: 'Rata-rata Pengeluaran', columnName: 'Pengeluaran', aggregation: 'avg', format: 'currency', trendPercentage: -3.2 },
          { id: 'kpi-4', label: 'Total Periode Laporan', columnName: 'Bulan', aggregation: 'count', format: 'number' },
        ],
        charts: [
          { id: 'chart-1', title: 'Tren Pendapatan vs Laba Bersih', chartType: 'line', xAxisColumn: 'Bulan', yAxisColumns: ['Pendapatan', 'Laba Bersih'], width: 'full' },
          { id: 'chart-2', title: 'Distribusi Pendapatan per Kategori', chartType: 'pie', xAxisColumn: 'Kategori', yAxisColumns: ['Pendapatan'], width: 'half' },
          { id: 'chart-3', title: 'Perbandingan Laba per Region', chartType: 'bar', xAxisColumn: 'Region', yAxisColumns: ['Laba Bersih'], width: 'half' },
        ],
      },
      createdAt: '2024-09-02T14:30:00Z',
      updatedAt: '2024-09-02T14:30:00Z',
      deletedAt: null,
    });
  }

  async getUserDashboards(userId: string, userRole: string = 'FREE', includeDeleted = false): Promise<any[]> {
    const results: any[] = [];
    const seenIds = new Set<string>();
    const isPremium = userRole.toUpperCase() === 'PREMIUM' || userRole.toUpperCase() === 'SUPERADMIN';
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      if (prisma?.dashboard?.findMany) {
        const dbDashboards = await prisma.dashboard.findMany({
          where: {
            dataset: { userId },
            ...(includeDeleted ? {} : { deletedAt: null }),
            // For FREE users, only include active dashboards created within the last 7 days
            ...(!isPremium && !includeDeleted ? { createdAt: { gte: sevenDaysAgo } } : {}),
          },
          include: { dataset: true, template: true },
          orderBy: { createdAt: 'desc' },
        });

        if (dbDashboards && dbDashboards.length > 0) {
          for (const d of dbDashboards) {
            const inMem = this.dashboards.get(d.id);
            const cfg = inMem?.config || (typeof d.config === 'object' && d.config !== null ? d.config : {});
            const createdAtStr = d.createdAt?.toISOString ? d.createdAt.toISOString() : String(d.createdAt);
            const retention = retentionService.calculateRetention(createdAtStr, userRole);

            results.push({
              id: d.id,
              userId,
              datasetId: d.datasetId,
              title: inMem?.title || d.title,
              subtitle: inMem?.subtitle || '',
              description: inMem?.description || d.description || '',
              themeId: inMem?.themeId || d.templateId || 'minimal-teal',
              templateId: inMem?.templateId || d.templateId || 'minimal-teal',
              isPublic: inMem?.isPublic ?? !!d.isPublicShare,
              publicId: inMem?.publicId || d.shareToken,
              config: cfg,
              charts: inMem?.charts || (cfg as any)?.charts || [],
              filters: inMem?.filters || (cfg as any)?.filters || { currency: 'IDR' },
              layout: inMem?.layout || (cfg as any)?.layout || { charts: (cfg as any)?.charts || [], kpis: [] },
              dataset: d.dataset ? {
                id: d.dataset.id,
                userId: d.dataset.userId,
                fileName: d.dataset.fileName,
                fileSize: d.dataset.fileSize,
                rowCount: d.dataset.rowCount,
                columns: d.dataset.columns,
                uploadedAt: d.dataset.uploadedAt,
              } : undefined,
              createdAt: createdAtStr,
              updatedAt: inMem?.updatedAt || (d.updatedAt?.toISOString ? d.updatedAt.toISOString() : String(d.updatedAt)),
              deletedAt: d.deletedAt,
              retention,
            });
            seenIds.add(d.id);
          }
          return results;
        }
      }
    } catch (err) {
      console.warn('Prisma getUserDashboards error, fallback to memory:', err);
    }

    const inMemList = Array.from(this.dashboards.values()).filter((d) => {
      const isUser = d.userId === userId || (userId === 'usr-alex-chen' && d.userId === 'usr-alex-chen');
      if (!isUser) return false;
      if (!includeDeleted && d.deletedAt) return false;
      if (!isPremium && !includeDeleted) {
        const createdTime = new Date(d.createdAt).getTime();
        if (createdTime < sevenDaysAgo.getTime()) return false;
      }
      return true;
    });

    for (const dash of inMemList) {
      if (!seenIds.has(dash.id)) {
        const retention = retentionService.calculateRetention(dash.createdAt, userRole);
        results.push({
          ...dash,
          retention,
        });
        seenIds.add(dash.id);
      }
    }

    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUserTrashDashboards(userId: string): Promise<any[]> {
    const results: any[] = [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      if (prisma?.dashboard?.findMany) {
        const dbTrash = await prisma.dashboard.findMany({
          where: {
            dataset: { userId },
            deletedAt: {
              not: null,
              gte: sevenDaysAgo,
            },
          },
          include: { dataset: true, template: true },
          orderBy: { deletedAt: 'desc' },
          includeDeleted: true,
        } as any);

        if (dbTrash && dbTrash.length > 0) {
          for (const d of dbTrash) {
            const inMem = this.dashboards.get(d.id);
            const cfg = inMem?.config || (typeof d.config === 'object' && d.config !== null ? d.config : {});
            const deletedAtStr = d.deletedAt?.toISOString ? d.deletedAt.toISOString() : String(d.deletedAt);
            const trashRetention = retentionService.calculateTrashRetention(deletedAtStr);

            results.push({
              id: d.id,
              userId,
              datasetId: d.datasetId,
              title: inMem?.title || d.title,
              subtitle: inMem?.subtitle || '',
              description: inMem?.description || d.description || '',
              themeId: inMem?.themeId || d.templateId || 'minimal-teal',
              templateId: inMem?.templateId || d.templateId || 'minimal-teal',
              isPublic: inMem?.isPublic ?? !!d.isPublicShare,
              publicId: inMem?.publicId || d.shareToken,
              config: cfg,
              charts: inMem?.charts || (cfg as any)?.charts || [],
              filters: inMem?.filters || (cfg as any)?.filters || { currency: 'IDR' },
              layout: inMem?.layout || (cfg as any)?.layout || { charts: (cfg as any)?.charts || [], kpis: [] },
              dataset: d.dataset ? {
                id: d.dataset.id,
                userId: d.dataset.userId,
                fileName: d.dataset.fileName,
                fileSize: d.dataset.fileSize,
                rowCount: d.dataset.rowCount,
                columns: d.dataset.columns,
                uploadedAt: d.dataset.uploadedAt,
              } : undefined,
              createdAt: d.createdAt?.toISOString ? d.createdAt.toISOString() : String(d.createdAt),
              updatedAt: inMem?.updatedAt || (d.updatedAt?.toISOString ? d.updatedAt.toISOString() : String(d.updatedAt)),
              deletedAt: deletedAtStr,
              trashRetention,
            });
          }
          return results;
        }
      }
    } catch (err) {
      console.warn('Prisma getUserTrashDashboards error, fallback to memory:', err);
    }

    const inMemTrash = Array.from(this.dashboards.values()).filter((d) => {
      if (!d.deletedAt) return false;
      const isUser = d.userId === userId || (userId === 'usr-alex-chen' && d.userId === 'usr-alex-chen');
      const deletedTime = new Date(d.deletedAt).getTime();
      return isUser && deletedTime >= sevenDaysAgo.getTime();
    });

    for (const dash of inMemTrash) {
      const trashRetention = retentionService.calculateTrashRetention(dash.deletedAt || new Date());
      results.push({
        ...dash,
        trashRetention,
      });
    }

    return results.sort((a, b) => new Date(b.deletedAt || 0).getTime() - new Date(a.deletedAt || 0).getTime());
  }

  async getDashboardById(id: string, userId: string, includeDeleted = false): Promise<Dashboard> {
    try {
      if (prisma?.dashboard?.findUnique) {
        const d = await prisma.dashboard.findUnique({
          where: { id },
          include: { dataset: true },
        });
        if (d && (includeDeleted || !d.deletedAt)) {
          const cfg = typeof d.config === 'object' && d.config !== null ? d.config : {};
          const dash: Dashboard = {
            id: d.id,
            userId: d.dataset?.userId || userId,
            datasetId: d.datasetId,
            title: d.title,
            description: d.description || '',
            themeId: d.templateId || 'minimal-teal',
            templateId: d.templateId || 'minimal-teal',
            isPublic: !!d.isPublicShare,
            publicId: d.shareToken,
            config: cfg,
            charts: (cfg as any)?.charts || [],
            filters: (cfg as any)?.filters || { currency: 'IDR' },
            layout: (cfg as any)?.layout || { charts: (cfg as any)?.charts || [], kpis: [] },
            createdAt: d.createdAt?.toISOString ? d.createdAt.toISOString() : String(d.createdAt),
            updatedAt: d.updatedAt?.toISOString ? d.updatedAt.toISOString() : String(d.updatedAt),
            deletedAt: d.deletedAt,
          };
          this.dashboards.set(id, dash);
          return dash;
        }
      }
    } catch {
      // Safe fallback
    }

    const dashboard = this.dashboards.get(id);
    if (!dashboard || (!includeDeleted && dashboard.deletedAt)) {
      throw { statusCode: 404, code: 'DASHBOARD_NOT_FOUND', message: 'Dashboard tidak ditemukan.' };
    }
    return dashboard;
  }

  async getPublicDashboard(publicId: string): Promise<Dashboard> {
    const dashboard = Array.from(this.dashboards.values()).find(
      (d) => d.isPublic && d.publicId === publicId && !d.deletedAt
    );
    if (!dashboard) {
      throw { statusCode: 404, code: 'PUBLIC_DASHBOARD_NOT_FOUND', message: 'Tautan dashboard publik tidak valid atau telah dinonaktifkan.' };
    }
    return dashboard;
  }

  async getAllDashboards(includeDeleted = false): Promise<Dashboard[]> {
    return Array.from(this.dashboards.values()).filter((d) => includeDeleted || !d.deletedAt);
  }

  async createDashboard(userId: string, data: {
    id?: string;
    datasetId?: string;
    title: string;
    subtitle?: string;
    description?: string;
    themeId?: string;
    templateId?: string;
    layout?: any;
    config?: any;
    charts?: any[];
    kpis?: any[];
    filters?: any;
    isPublic?: boolean;
  }): Promise<Dashboard> {
    // 1. Resolve & ensure valid User ID in Prisma
    const verifiedUserId = await ensurePrismaUser(userId);

    // 2. Enforce Plan Limits dynamically (per-plan configurable limit)
    try {
      const limits = await getUserPlanLimits(verifiedUserId);
      if (!limits.canCreateDashboard && limits.dashboardLimit !== null) {
        throw {
          statusCode: 403,
          code: 'DASHBOARD_LIMIT_REACHED',
          message: `Anda telah mencapai batas ${limits.dashboardLimit} dashboard untuk paket ${limits.planName}. Upgrade paket Anda untuk membuat dashboard tanpa batas.`,
        };
      }

      // Enforce premium chart type gating (bar-horizontal, map) for new dashboards
      const restrictedChartTypes = ['bar-horizontal', 'map'];
      const rawCharts = data.charts || data.config?.charts || data.layout?.charts || [];
      const hasRestrictedChart = rawCharts.some((c: any) =>
        restrictedChartTypes.includes(c?.chartType || c?.type)
      );
      if (hasRestrictedChart && !limits.isPremiumRole) {
        throw {
          statusCode: 403,
          code: 'PREMIUM_CHART_TYPE_RESTRICTED',
          message: 'Tipe grafik Peta dan Bar Horizontal adalah fitur eksklusif untuk pengguna Premium. Silakan tingkatkan paket Anda.',
        };
      }
    } catch (err: any) {
      if (
        err.code === 'DASHBOARD_LIMIT_REACHED' ||
        err.code === 'PREMIUM_CHART_TYPE_RESTRICTED' ||
        err.statusCode === 403
      ) {
        throw err;
      }
    }

    const id = data.id || ('dash-' + Math.random().toString(36).substring(2, 9));
    const publicId = data.isPublic ? 'share-' + Math.random().toString(36).substring(2, 10) : undefined;
    const themeId = data.themeId || data.templateId || 'minimal-teal';
    const rawTemplateId = data.templateId || data.themeId || 'minimal-teal';
    const charts = data.charts || data.config?.charts || data.layout?.charts || [];

    const fullConfig = {
      charts,
      filters: data.filters || { currency: 'IDR' },
      statCardConfigs: data.config?.statCardConfigs || data.filters?.statCardConfigs || [],
      columnFormats: data.config?.columnFormats || data.filters?.columnFormats || {},
      ...(data.config || {}),
    };

    // 3. Ensure Dataset exists in Prisma for this verified user
    const targetDatasetId = await ensurePrismaDataset(data.datasetId || 'ds-sample-financial', verifiedUserId);

    // 4. Ensure Template exists in Prisma
    const validTemplateId = await ensurePrismaTemplate(rawTemplateId);

    const newDashboard: Dashboard = {
      id,
      userId: verifiedUserId,
      datasetId: targetDatasetId,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      themeId,
      templateId: validTemplateId,
      isPublic: !!data.isPublic,
      publicId,
      charts,
      kpis: data.kpis || [],
      filters: data.filters || { currency: 'IDR' },
      config: fullConfig,
      layout: data.layout || {
        charts,
        kpis: data.kpis || [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    try {
      if (prisma?.dashboard?.create) {
        const createdDb = await prisma.dashboard.create({
          data: {
            id,
            datasetId: targetDatasetId,
            templateId: validTemplateId,
            title: data.title,
            config: fullConfig as any,
            isPublicShare: !!data.isPublic,
            shareToken: publicId || id,
          },
          include: { dataset: true, template: true },
        });

        if (createdDb) {
          newDashboard.createdAt = createdDb.createdAt.toISOString();
          newDashboard.updatedAt = createdDb.updatedAt.toISOString();
        }
      }
    } catch (err: any) {
      // If error is limit error, bubble up
      if (err.code === 'DASHBOARD_LIMIT_REACHED' || err.statusCode === 403) {
        throw err;
      }
      console.warn('Dashboard save fallback:', err?.message || err);
    }

    this.dashboards.set(id, newDashboard);
    return newDashboard;
  }

  async updateDashboard(id: string, userId: string, updates: Partial<Dashboard>): Promise<Dashboard> {
    let dashboard = this.dashboards.get(id);

    if (!dashboard) {
      try {
        if (prisma?.dashboard?.findUnique) {
          const d = await prisma.dashboard.findUnique({
            where: { id },
            include: { dataset: true },
          });
          if (d && (!d.deletedAt || updates.deletedAt === null)) {
            const cfg = typeof d.config === 'object' && d.config !== null ? d.config : {};
            dashboard = {
              id: d.id,
              userId: d.dataset?.userId || userId,
              datasetId: d.datasetId,
              title: d.title,
              description: d.description || '',
              themeId: d.templateId || 'minimal-teal',
              templateId: d.templateId || 'minimal-teal',
              isPublic: !!d.isPublicShare,
              publicId: d.shareToken,
              config: cfg,
              charts: (cfg as any)?.charts || [],
              filters: (cfg as any)?.filters || { currency: 'IDR' },
              layout: (cfg as any)?.layout || { charts: (cfg as any)?.charts || [], kpis: [] },
              createdAt: d.createdAt?.toISOString ? d.createdAt.toISOString() : String(d.createdAt),
              updatedAt: d.updatedAt?.toISOString ? d.updatedAt.toISOString() : String(d.updatedAt),
              deletedAt: d.deletedAt,
            };
            this.dashboards.set(id, dashboard);
          }
        }
      } catch {
        // DB lookup fallback
      }
    }

    // If still not found (e.g. client generated temporary ID or offline draft like dash-1787980719053),
    // gracefully upsert / create it instead of failing with 404!
    if (!dashboard) {
      const isPublic = !!updates.isPublic;
      const themeId = updates.themeId || updates.templateId || 'minimal-teal';
      const templateId = updates.templateId || updates.themeId || 'minimal-teal';
      const charts = updates.charts || (updates.config as any)?.charts || (updates.layout as any)?.charts || [];

      const fullConfig = {
        charts,
        filters: updates.filters || { currency: 'IDR' },
        ...(updates.config || {}),
      };

      dashboard = {
        id,
        userId: updates.userId || userId,
        datasetId: updates.datasetId || 'ds-sample-financial',
        title: updates.title || 'Dashboard Baru',
        subtitle: updates.subtitle || '',
        description: updates.description || '',
        themeId,
        templateId,
        isPublic,
        publicId: isPublic ? (updates.publicId || 'share-' + Math.random().toString(36).substring(2, 10)) : undefined,
        charts,
        kpis: updates.kpis || [],
        filters: updates.filters || { currency: 'IDR' },
        config: fullConfig,
        layout: updates.layout || { charts, kpis: updates.kpis || [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      this.dashboards.set(id, dashboard);

      try {
        if (prisma?.dashboard?.upsert) {
          await prisma.dashboard.upsert({
            where: { id },
            update: {
              title: dashboard.title,
              templateId: dashboard.templateId,
              config: dashboard.config as any,
              isPublicShare: dashboard.isPublic,
              shareToken: dashboard.publicId || dashboard.id,
              updatedAt: new Date(),
            },
            create: {
              id,
              datasetId: dashboard.datasetId,
              templateId: dashboard.templateId,
              title: dashboard.title,
              config: dashboard.config as any,
              isPublicShare: dashboard.isPublic,
              shareToken: dashboard.publicId || dashboard.id,
            },
          });
        }
      } catch {
        // Safe fallback
      }

      return dashboard;
    }

    if (updates.isPublic && !dashboard.publicId) {
      updates.publicId = 'share-' + Math.random().toString(36).substring(2, 10);
    }

    const updated: Dashboard = {
      ...dashboard,
      ...updates,
      config: {
        ...(typeof dashboard.config === 'object' && dashboard.config !== null ? dashboard.config : {}),
        ...(typeof updates.config === 'object' && updates.config !== null ? updates.config : {}),
        ...(updates.charts ? { charts: updates.charts } : {}),
        ...(updates.filters ? { filters: updates.filters } : {}),
      },
      updatedAt: new Date().toISOString(),
    };

    this.dashboards.set(id, updated);

    try {
      if (prisma?.dashboard?.update) {
        await prisma.dashboard.update({
          where: { id },
          data: {
            title: updated.title,
            templateId: updated.templateId || updated.themeId,
            config: updated.config as any,
            isPublicShare: !!updated.isPublic,
            shareToken: updated.publicId || updated.id,
            updatedAt: new Date(),
          },
        });
      }
    } catch {
      // Safe fallback
    }

    return updated;
  }

  async duplicateDashboard(id: string, userId: string): Promise<Dashboard> {
    const original = await this.getDashboardById(id, userId);
    return this.createDashboard(userId, {
      datasetId: original.datasetId,
      title: `${original.title} (Salinan)`,
      subtitle: original.subtitle,
      description: original.description,
      themeId: original.themeId || original.templateId,
      templateId: original.templateId || original.themeId,
      charts: original.charts,
      kpis: original.kpis,
      filters: original.filters,
      config: original.config,
      layout: original.layout,
      isPublic: false,
    });
  }

  async deleteDashboard(id: string, userId: string): Promise<void> {
    let dashboard = this.dashboards.get(id);
    if (!dashboard && prisma?.dashboard?.findUnique) {
      try {
        const dbRecord = await prisma.dashboard.findUnique({
          where: { id },
          include: { dataset: true },
        });
        if (dbRecord && (!dbRecord.dataset || dbRecord.dataset.userId === userId || userId === 'usr-alex-chen')) {
          dashboard = {
            id: dbRecord.id,
            userId: dbRecord.dataset?.userId || userId,
            datasetId: dbRecord.datasetId,
            title: dbRecord.title,
            themeId: dbRecord.templateId,
            templateId: dbRecord.templateId,
            isPublic: !!dbRecord.isPublicShare,
            config: dbRecord.config as any,
            charts: [],
            kpis: [],
            filters: { currency: 'IDR' },
            createdAt: dbRecord.createdAt.toISOString(),
            updatedAt: dbRecord.updatedAt.toISOString(),
            deletedAt: dbRecord.deletedAt ? dbRecord.deletedAt.toISOString() : null,
          };
        }
      } catch {
        // Fallback
      }
    }

    if (!dashboard) {
      throw { statusCode: 404, code: 'DASHBOARD_NOT_FOUND', message: 'Dashboard tidak ditemukan.' };
    }
    dashboard.deletedAt = new Date().toISOString();
    dashboard.updatedAt = new Date().toISOString();
    this.dashboards.set(id, dashboard);

    try {
      if (prisma?.dashboard?.update) {
        await prisma.dashboard.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
      }
    } catch {
      // Handled by soft-delete proxy
    }
  }

  async restoreDashboard(id: string, userId: string): Promise<Dashboard> {
    let dashboard = this.dashboards.get(id);

    try {
      if (prisma?.dashboard?.update) {
        await prisma.dashboard.update({
          where: { id },
          data: { deletedAt: null, updatedAt: new Date() },
          includeDeleted: true,
        } as any);
      }
    } catch (err) {
      console.warn('Prisma restore error:', err);
    }

    if (dashboard) {
      dashboard.deletedAt = null;
      dashboard.updatedAt = new Date().toISOString();
      this.dashboards.set(id, dashboard);
      return dashboard;
    }

    return this.getDashboardById(id, userId, true);
  }

  async permanentDeleteDashboard(id: string, userId: string): Promise<void> {
    this.dashboards.delete(id);

    try {
      if (prisma?.dashboard?.deleteMany) {
        await prisma.dashboard.deleteMany({
          where: { id },
          includeDeleted: true,
        } as any);
      }
    } catch (err) {
      console.warn('Prisma permanent delete error:', err);
    }
  }
}

export const dashboardService = new DashboardService();



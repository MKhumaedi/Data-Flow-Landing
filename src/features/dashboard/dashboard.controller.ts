import { Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { datasetService } from '../dataset/dataset.service';
import { excelExportService } from './export/excelExport.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { prisma } from '../../lib/prisma';

export class DashboardController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      let role = req.user?.role || 'FREE';
      try {
        const userRecord = await prisma.user.findUnique({ where: { id: userId } });
        if (userRecord?.role) {
          role = userRecord.role;
        }
      } catch {
        // Fallback to token role
      }
      const isPremium = role === 'PREMIUM' || role === 'SUPERADMIN';
      const dashboards = await dashboardService.getUserDashboards(userId, role);

      res.json({
        dashboards,
        usage: {
          current: dashboards.length,
          max: isPremium ? null : 3,
          plan: role.toLowerCase(),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async listTrash(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dashboards = await dashboardService.getUserTrashDashboards(userId);
      res.json({ dashboards });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dashboard = await dashboardService.getDashboardById(req.params.id, userId);
      let dataset = null;
      if (dashboard.datasetId) {
        try {
          dataset = await datasetService.getDatasetById(dashboard.datasetId, userId);
        } catch {
          // optional if dataset not found
        }
      }
      res.json({ dashboard, dataset });
    } catch (err) {
      next(err);
    }
  }

  async getPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dashboard = await dashboardService.getPublicDashboard(req.params.publicId);
      res.json({ dashboard });
    } catch (err) {
      next(err);
    }
  }

  async exportExcel(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.verificationStatus === 'PENDING') {
        res.status(403).json({
          success: false,
          error: {
            code: 'VERIFICATION_REQUIRED',
            message: 'Akun Anda belum terverifikasi. Selesaikan verifikasi WhatsApp untuk mengekspor Excel.',
          },
        });
        return;
      }

      const userId = req.user?.userId || 'usr-alex-chen';
      const dashId = req.params.id;

      let dashboard: any = null;
      let dataset: any = null;

      try {
        dashboard = await dashboardService.getDashboardById(dashId, userId);
      } catch {
        // Fallback
      }

      if (dashboard?.datasetId) {
        try {
          dataset = await datasetService.getDatasetById(dashboard.datasetId, userId);
        } catch {
          // Fallback
        }
      }

      // Check for body payload (e.g. when POSTed from client with live active state)
      const bodyCharts = req.body?.charts || req.body?.dashboard?.charts;
      const bodyRows = req.body?.datasetRows || req.body?.dataset?.data || req.body?.data;
      const bodyCols = req.body?.columns || req.body?.dataset?.columns;
      const bodyKpis = req.body?.kpis;
      const bodyFormats = req.body?.formatConfigs || req.body?.columnFormats || req.body?.dashboard?.filters?.columnFormats;
      const bodyHeaderSettings = req.body?.headerSettings || (dashboard?.config as any)?.headerSettings;
      const bodyStatCards =
        req.body?.statCards ||
        (dashboard?.config as any)?.headerSettings?.statCards ||
        (dashboard?.config as any)?.statCardConfigs ||
        (dashboard?.filters as any)?.statCardConfigs;

      const activeCharts = bodyCharts || dashboard?.charts || (dashboard?.config as any)?.charts || [];
      const activeRows = bodyRows || dataset?.data || dataset?.sampleData || (dataset as any)?.rawData || [];
      const activeCols = bodyCols || dataset?.columns || [];
      const activeFormats = bodyFormats || (dashboard?.config as any)?.columnFormats || dashboard?.filters?.columnFormats || {};
      const activeKpis = bodyKpis || dashboard?.kpis || [];

      const title = req.body?.title || (typeof req.query.title === 'string' ? req.query.title : dashboard?.title) || 'Laporan Executive Dashboard';
      const currency = (req.body?.currency || req.query.currency || dashboard?.filters?.currency || 'IDR') as string;

      const screenshotBase64 =
        typeof req.body?.dashboardScreenshotBase64 === 'string'
          ? req.body.dashboardScreenshotBase64
          : typeof req.body?.dashboardImageBase64 === 'string'
          ? req.body.dashboardImageBase64
          : undefined;

      const excelBuffer = await excelExportService.generateDashboardExcel({
        dashboardTitle: title,
        currency,
        charts: activeCharts,
        datasetRows: activeRows,
        columns: activeCols,
        kpis: activeKpis,
        headerSettings: bodyHeaderSettings,
        statCards: bodyStatCards,
        formatConfigs: activeFormats,
        customMapBase64: typeof req.body?.mapImageBase64 === 'string' ? req.body.mapImageBase64 : undefined,
        dashboardScreenshotBase64: screenshotBase64,
      });

      const sanitizedFilename = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="maystudio_${sanitizedFilename}.xlsx"`);
      res.status(200).send(excelBuffer);
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dashboard = await dashboardService.createDashboard(userId, req.body);
      res.status(201).json({ dashboard });
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dashboard = await dashboardService.updateDashboard(req.params.id, userId, req.body);
      res.json({ dashboard });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      await dashboardService.deleteDashboard(req.params.id, userId);
      res.json({ success: true, message: 'Dashboard berhasil dipindahkan ke sampah.' });
    } catch (err) {
      next(err);
    }
  }

  async restore(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dashboard = await dashboardService.restoreDashboard(req.params.id, userId);
      res.json({ success: true, dashboard, message: 'Dashboard berhasil dipulihkan.' });
    } catch (err) {
      next(err);
    }
  }

  async permanentDelete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      await dashboardService.permanentDeleteDashboard(req.params.id, userId);
      res.json({ success: true, message: 'Dashboard berhasil dihapus permanen.' });
    } catch (err) {
      next(err);
    }
  }

  async duplicate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dashboard = await dashboardService.duplicateDashboard(req.params.id, userId);
      res.status(201).json({ dashboard });
    } catch (err) {
      next(err);
    }
  }

  async claimDraft(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: { message: 'Autentikasi diperlukan untuk menyimpan dashboard.' } });
        return;
      }

      const { dataset, dashboard } = req.body;
      if (!dataset && !dashboard) {
        res.status(400).json({ success: false, error: { message: 'Data draft tidak valid atau kosong.' } });
        return;
      }

      // 1. Create Dataset record atomically with all rows and columns
      let createdDataset = null;
      if (dataset) {
        createdDataset = await datasetService.createDataset(userId, {
          fileName: dataset.fileName || dataset.filename || 'Dataset_Laporan.xlsx',
          fileSize: dataset.fileSize || 10240,
          rowCount: dataset.rowCount || (dataset.data?.length ?? 0),
          columnCount: dataset.columnCount || (dataset.columns?.length ?? 0),
          columns: dataset.columns || [],
          data: dataset.data || dataset.sampleData || [],
          sampleData: dataset.sampleData || (dataset.data ? dataset.data.slice(0, 20) : []),
        });
      }

      // 2. Extract and normalize full chart configs, sizes, dimensions, metrics, and templates
      const rawCharts = dashboard?.charts || dashboard?.config?.charts || dashboard?.layout?.charts || [];
      const normalizedCharts = Array.isArray(rawCharts) ? rawCharts.map((c: any) => ({
        id: c.id || `chart-${Math.random().toString(36).substring(2, 7)}`,
        title: c.title || 'Grafik',
        subtitle: c.subtitle || '',
        chartType: c.chartType || 'bar',
        dimensionColumn: c.dimensionColumn || c.xAxisColumn || '',
        metricColumn: c.metricColumn || (Array.isArray(c.yAxisColumns) ? c.yAxisColumns[0] : '') || '',
        secondaryMetricColumn: c.secondaryMetricColumn || (Array.isArray(c.yAxisColumns) && c.yAxisColumns.length > 1 ? c.yAxisColumns[1] : undefined),
        aggregation: c.aggregation || 'SUM',
        colorScheme: c.colorScheme,
        gridSpan: c.gridSpan || (c.gridWidth === 'full' ? 4 : c.gridWidth === '2/3' ? 3 : c.gridWidth === '1/3' ? 1 : 2),
        gridWidth: c.gridWidth || (c.gridSpan === 4 ? 'full' : c.gridSpan === 3 ? '2/3' : c.gridSpan === 1 ? '1/3' : '1/2'),
        gridHeight: c.gridHeight || 'medium',
        sortBy: c.sortBy,
        limit: c.limit,
        targetValue: c.targetValue,
      })) : [];

      const statCardConfigs = dashboard?.config?.statCardConfigs || dashboard?.filters?.statCardConfigs || [];
      const columnFormats = dashboard?.config?.columnFormats || dashboard?.filters?.columnFormats || {};
      const templateId = dashboard?.templateId || dashboard?.themeId || 'minimal-teal';

      const fullConfig = {
        charts: normalizedCharts,
        statCardConfigs,
        columnFormats,
        filters: dashboard?.filters || {},
        ...(dashboard?.config || {}),
      };

      const createdDashboard = await dashboardService.createDashboard(userId, {
        datasetId: createdDataset?.id || dashboard?.datasetId || 'ds-sample-financial',
        title: dashboard?.title?.trim() || 'Executive Financial & Growth Overview',
        subtitle: dashboard?.subtitle,
        description: dashboard?.description || 'Dashboard yang dimigrasikan dari sesi guest',
        themeId: templateId,
        templateId: templateId,
        charts: normalizedCharts,
        kpis: dashboard?.kpis || [],
        filters: {
          currency: dashboard?.filters?.currency || 'IDR',
          columnFormats,
          statCardConfigs,
        },
        config: fullConfig,
        layout: {
          charts: normalizedCharts,
          kpis: dashboard?.kpis || [],
        },
        isPublic: !!dashboard?.isPublic,
      });

      res.status(201).json({
        success: true,
        message: 'Draft berhasil dimigrasikan ke akun Anda secara lengkap.',
        dataset: createdDataset,
        dashboard: createdDashboard,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const dashboardController = new DashboardController();


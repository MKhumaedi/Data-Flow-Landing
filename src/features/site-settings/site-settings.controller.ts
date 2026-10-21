import { Request, Response, NextFunction } from 'express';
import { siteSettingsService } from './site-settings.service';

export class SiteSettingsController {
  async getPublicIntegrations(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await siteSettingsService.getPublicSettings();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getAdminIntegrations(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await siteSettingsService.getIntegrationSettings();
      res.json({ success: true, data: data || {
        id: '',
        gtmContainerId: null,
        ga4MeasurementId: null,
        gscVerificationCode: null,
        customHeadScript: null,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
      }});
    } catch (err) {
      next(err);
    }
  }

  async updateAdminIntegrations(req: any, res: Response, next: NextFunction): Promise<void> {
    try {
      const { gtmContainerId, ga4MeasurementId, gscVerificationCode, customHeadScript } = req.body;
      const admin = req.user || { id: 'admin-user', email: 'admin@maystudio.app' };

      const updated = await siteSettingsService.upsertIntegrationSettings(
        { gtmContainerId, ga4MeasurementId, gscVerificationCode, customHeadScript },
        admin
      );

      res.json({
        success: true,
        message: 'Pengaturan integrasi & analitik berhasil disimpan.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const siteSettingsController = new SiteSettingsController();

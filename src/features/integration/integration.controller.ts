import { Request, Response, NextFunction } from 'express';
import { integrationService } from './integration.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class IntegrationController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const integrations = await integrationService.getIntegrations(userId);
      res.json({
        success: true,
        data: { integrations },
      });
    } catch (err) {
      next(err);
    }
  }

  async toggle(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const result = await integrationService.toggleIntegration(
        userId,
        req.params.id,
        req.body.connected
      );
      res.json({
        success: true,
        data: result,
        message: result.connected ? 'Integrasi berhasil dihubungkan.' : 'Integrasi dinonaktifkan.',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const integrationController = new IntegrationController();

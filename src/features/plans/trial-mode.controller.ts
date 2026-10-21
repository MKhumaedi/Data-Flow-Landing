import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { trialModeService } from './trial-mode.service';

export class TrialModeController {
  /**
   * GET /api/plans/trial-mode or /api/trial-mode (Public)
   */
  async getStatus(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = await trialModeService.getTrialModeStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/trial-mode/activate (Superadmin only)
   */
  async activate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || req.user?.id || 'admin';
      const adminEmail = req.user?.email || 'admin@maystudio.app';
      const { label, startAt, endAt } = req.body;

      if (!endAt) {
        res.status(400).json({
          success: false,
          error: { code: 'END_DATE_REQUIRED', message: 'Waktu berakhir (endAt) wajib ditentukan.' },
        });
        return;
      }

      const status = await trialModeService.activateTrialMode({
        label,
        startAt,
        endAt,
        adminId,
        adminEmail,
      });

      res.json({
        success: true,
        message: 'Mode Trial Global berhasil diaktifkan.',
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/admin/trial-mode/deactivate (Superadmin only)
   */
  async deactivate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user?.userId || req.user?.id || 'admin';
      const adminEmail = req.user?.email || 'admin@maystudio.app';

      const status = await trialModeService.deactivateTrialMode({
        adminId,
        adminEmail,
      });

      res.json({
        success: true,
        message: 'Mode Trial Global berhasil dinonaktifkan.',
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const trialModeController = new TrialModeController();

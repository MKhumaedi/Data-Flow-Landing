import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { cvMatchService } from './cv-match.service';

export class CVController {
  async getQuota(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Silakan masuk terlebih dahulu.' },
        });
        return;
      }

      const isPremium = req.user?.role === 'PREMIUM' || req.user?.role === 'SUPERADMIN';
      const quota = await cvMatchService.getMonthlyUsage(userId, isPremium);

      res.json({
        success: true,
        data: quota,
      });
    } catch (err) {
      next(err);
    }
  }

  async analyzeMatch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id || req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Silakan login untuk menggunakan fitur analisis kecocokan CV.' },
        });
        return;
      }

      const role = req.user?.role || 'FREE';
      const { cvData, jobDescription } = req.body;

      const { result, quota } = await cvMatchService.analyzeCVMatch(userId, role, {
        cvData: cvData || {},
        jobDescription: jobDescription || '',
      });

      res.json({
        success: true,
        data: result,
        quota,
      });
    } catch (err: any) {
      if (err?.statusCode) {
        res.status(err.statusCode).json({
          success: false,
          error: {
            code: err.code || 'AI_ERROR',
            message: err.message || 'Gagal menganalisis kecocokan CV.',
          },
          quota: err.quota,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'AI_ANALYSIS_FAILED',
          message: 'Gagal menganalisis kecocokan CV, silakan coba lagi beberapa saat lagi.',
        },
      });
    }
  }
}

export const cvController = new CVController();

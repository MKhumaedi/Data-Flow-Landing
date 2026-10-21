import { Request, Response, NextFunction } from 'express';
import { datasetService } from './dataset.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class DatasetController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const datasets = await datasetService.getUserDatasets(userId);
      res.json({
        success: true,
        data: { datasets },
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dataset = await datasetService.getDatasetById(req.params.id, userId);
      res.json({
        success: true,
        data: { dataset },
      });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      const dataset = await datasetService.createDataset(userId, req.body);
      res.status(201).json({
        success: true,
        data: { dataset },
        message: 'Dataset berhasil diproses dan disimpan.',
      });
    } catch (err) {
      next(err);
    }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || 'usr-alex-chen';
      await datasetService.deleteDataset(req.params.id, userId);
      res.json({
        success: true,
        message: 'Dataset berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const datasetController = new DatasetController();

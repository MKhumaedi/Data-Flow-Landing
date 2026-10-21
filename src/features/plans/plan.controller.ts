import { Request, Response, NextFunction } from 'express';
import { planService } from './plan.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class PlanController {
  async listActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plans = await planService.listActive();
      res.json({ success: true, data: { plans } });
    } catch (err) {
      next(err);
    }
  }

  async listAll(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const plans = await planService.listAll(includeArchived);
      res.json({ success: true, data: { plans } });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.getById(req.params.id);
      if (!plan) {
        res.status(404).json({ success: false, message: 'Paket tidak ditemukan' });
        return;
      }
      res.json({ success: true, data: { plan } });
    } catch (err) {
      next(err);
    }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.create(req.body, req.user);
      res.status(201).json({ success: true, data: { plan }, message: 'Paket langganan berhasil dibuat.' });
    } catch (err) {
      next(err);
    }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const plan = await planService.update(req.params.id, req.body, req.user);
      res.json({ success: true, data: { plan }, message: 'Paket langganan berhasil diperbarui.' });
    } catch (err) {
      next(err);
    }
  }

  async archive(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await planService.archive(req.params.id, req.user);
      res.json({ success: true, message: 'Paket berhasil diarsipkan.' });
    } catch (err) {
      next(err);
    }
  }

  async restore(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await planService.restore(req.params.id, req.user);
      res.json({ success: true, message: 'Paket berhasil dipulihkan.' });
    } catch (err) {
      next(err);
    }
  }

  async createPricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pricing = await planService.createPricing(req.params.id, req.body, req.user);
      res.status(201).json({ success: true, data: { pricing }, message: 'Opsi harga durasi berhasil ditambahkan.' });
    } catch (err) {
      next(err);
    }
  }

  async updatePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pricing = await planService.updatePricing(req.params.pricingId, req.body, req.user);
      res.json({ success: true, data: { pricing }, message: 'Opsi harga durasi berhasil diperbarui.' });
    } catch (err) {
      next(err);
    }
  }

  async deletePricing(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await planService.deletePricing(req.params.pricingId, req.user);
      res.json({ success: true, message: 'Opsi harga durasi berhasil dihapus.' });
    } catch (err) {
      next(err);
    }
  }

  async getUserLimits(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Autentikasi diperlukan' });
        return;
      }
      const limits = await planService.getUserPlanLimits(userId);
      res.json({ success: true, data: { limits } });
    } catch (err) {
      next(err);
    }
  }
}

export const planController = new PlanController();

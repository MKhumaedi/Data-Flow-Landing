import { Request, Response, NextFunction } from 'express';
import { adSlotService } from './ad-slot.service';
import { logAdminAction } from '../admin/audit-log/audit.helper';

export class AdSlotController {
  async getByPlacement(req: Request, res: Response, next: NextFunction) {
    try {
      const { placement } = req.params;
      const ad = await adSlotService.getActiveByPlacement(placement);
      return res.json({ success: true, data: ad });
    } catch (err) {
      next(err);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const includeDeleted = req.query.includeDeleted === 'true';
      const items = await adSlotService.listAllAdmin(includeDeleted);
      return res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  async create(req: any, res: Response, next: NextFunction) {
    try {
      const { placement, type, imageUrl, linkUrl, scriptCode, isActive } = req.body;
      if (!placement || !type) {
        return res.status(400).json({ success: false, message: 'Placement dan type wajib diisi' });
      }
      const adminEmail = req.user?.email || 'admin@maystudio.app';
      const item = await adSlotService.create({ placement, type, imageUrl, linkUrl, scriptCode, isActive }, adminEmail);
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail,
        action: 'CREATE_AD_SLOT',
        targetType: 'AD_SLOT',
        targetId: item.id,
        details: { placement: item.placement, type: item.type },
      });
      return res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }

  async update(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminEmail = req.user?.email || 'admin@maystudio.app';
      const updated = await adSlotService.update(id, req.body, adminEmail);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Ad Slot tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail,
        action: 'UPDATE_AD_SLOT',
        targetType: 'AD_SLOT',
        targetId: id,
        details: { placement: updated.placement, type: updated.type },
      });
      return res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async softDelete(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminEmail = req.user?.email || 'admin@maystudio.app';
      const success = await adSlotService.softDelete(id, adminEmail);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Ad Slot tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail,
        action: 'DELETE_AD_SLOT',
        targetType: 'AD_SLOT',
        targetId: id,
        details: { adSlotId: id },
      });
      return res.json({ success: true, message: 'Ad Slot berhasil diarsipkan' });
    } catch (err) {
      next(err);
    }
  }

  async restore(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminEmail = req.user?.email || 'admin@maystudio.app';
      const success = await adSlotService.restore(id, adminEmail);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Ad Slot tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail,
        action: 'RESTORE_AD_SLOT',
        targetType: 'AD_SLOT',
        targetId: id,
        details: { adSlotId: id },
      });
      return res.json({ success: true, message: 'Ad Slot berhasil dipulihkan' });
    } catch (err) {
      next(err);
    }
  }
}

export const adSlotController = new AdSlotController();

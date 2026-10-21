import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { adInventoryService } from './ad.service';

class AdInventoryController {
  async getActiveAd(req: Request, res: Response, next: NextFunction) {
    try {
      const { placementKey } = req.params;
      const data = await adInventoryService.getActiveBookingByPlacementKey(placementKey);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async serveAdImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { placementKey, filename } = req.params;
      const cleanPlacementKey = (placementKey || '').replace(/[^a-z0-9_-]/gi, '');
      const cleanFilename = (filename || '').replace(/[^a-z0-9_.-]/gi, '');

      const possiblePaths = [
        path.join(process.cwd(), 'public', 'uploads', 'ad-images', cleanPlacementKey, cleanFilename),
        path.join(process.cwd(), 'web', 'public', 'uploads', 'ad-images', cleanPlacementKey, cleanFilename),
      ];

      const foundPath = possiblePaths.find((p) => fs.existsSync(p));
      if (!foundPath) {
        return res.status(404).json({ success: false, message: 'Image not found' });
      }

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(foundPath);
    } catch (err) {
      next(err);
    }
  }

  async uploadBookingImage(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'File gambar tidak ditemukan.' });
      }

      const placementKey = req.body.placementKey || 'general';
      const dimensions = req.body.dimensions || null;

      const result = await adInventoryService.uploadBookingImage(
        req.file.buffer,
        placementKey,
        dimensions
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Gagal memproses gambar.' });
    }
  }

  async listPlacements(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adInventoryService.listPlacements();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createPlacement(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = { id: (req as any).user?.id || 'admin', email: (req as any).user?.email || 'admin@maystudio.app' };
      const data = await adInventoryService.createPlacement(req.body, admin);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updatePlacement(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = { id: (req as any).user?.id || 'admin', email: (req as any).user?.email || 'admin@maystudio.app' };
      const data = await adInventoryService.updatePlacement(req.params.id, req.body, admin);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async uploadPlacementPreview(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'File gambar screenshot tidak ditemukan.' });
      }
      const admin = { id: (req as any).user?.id || 'admin', email: (req as any).user?.email || 'admin@maystudio.app' };
      const data = await adInventoryService.uploadPlacementPreviewImage(
        req.params.id,
        req.file.buffer,
        admin
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message || 'Gagal menyimpan preview screenshot.' });
    }
  }

  async listBookings(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adInventoryService.listBookings();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = { id: (req as any).user?.id || 'admin', email: (req as any).user?.email || 'admin@maystudio.app' };
      const data = await adInventoryService.createBooking(req.body, admin);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async cancelBooking(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = { id: (req as any).user?.id || 'admin', email: (req as any).user?.email || 'admin@maystudio.app' };
      const data = await adInventoryService.cancelBooking(req.params.id, admin);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getPublicAdInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adInventoryService.getPublicAdInfo();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const { placementId, companyName, contactName, email, whatsapp, message, desiredDuration } = req.body;
      if (!placementId || !companyName || !contactName || !email || !whatsapp) {
        return res.status(400).json({
          success: false,
          message: 'Semua kolom wajib diisi (Posisi iklan, Nama Perusahaan/Brand, Nama Kontak, Email, WhatsApp).',
        });
      }

      const data = await adInventoryService.createInquiry({
        placementId,
        companyName,
        contactName,
        email,
        whatsapp,
        message,
        desiredDuration,
      });

      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async listInquiries(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await adInventoryService.listInquiries();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateInquiryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      if (!['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status tidak valid.' });
      }
      const admin = { id: (req as any).user?.id || 'admin', email: (req as any).user?.email || 'admin@maystudio.app' };
      const data = await adInventoryService.updateInquiryStatus(req.params.id, status, admin);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const adInventoryController = new AdInventoryController();

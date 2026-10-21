import { Request, Response, NextFunction } from 'express';
import { formService } from './form.service';
import { logAdminAction } from '../admin/audit-log/audit.helper';

export class FormController {
  async listPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await formService.listPublished();
      return res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const form = await formService.getBySlug(slug);
      if (!form) {
        return res.status(404).json({ success: false, message: 'Template formulir tidak ditemukan' });
      }
      return res.json({ success: true, data: form });
    } catch (err) {
      next(err);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const includeDeleted = req.query.includeDeleted === 'true';
      const items = await formService.listAllAdmin(includeDeleted);
      return res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  async create(req: any, res: Response, next: NextFunction) {
    try {
      const { title, category, description, fields, order, isPublished, slug } = req.body;
      if (!title || !category || !description || !fields) {
        return res.status(400).json({ success: false, message: 'Field title, category, description, dan fields wajib diisi' });
      }
      const item = await formService.create({
        title,
        category,
        description,
        fields,
        order,
        isPublished,
        slug,
      });
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'CREATE_FORM_TEMPLATE',
        targetType: 'FORM_TEMPLATE',
        targetId: item.id,
        details: { title: item.title, slug: item.slug, category: item.category },
      });
      return res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }

  async update(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await formService.update(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Template formulir tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'UPDATE_FORM_TEMPLATE',
        targetType: 'FORM_TEMPLATE',
        targetId: id,
        details: { title: updated.title, slug: updated.slug },
      });
      return res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async softDelete(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const success = await formService.softDelete(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Template formulir tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'DELETE_FORM_TEMPLATE',
        targetType: 'FORM_TEMPLATE',
        targetId: id,
        details: { formId: id },
      });
      return res.json({ success: true, message: 'Template formulir berhasil diarsipkan' });
    } catch (err) {
      next(err);
    }
  }

  async restore(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const success = await formService.restore(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Template formulir tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'RESTORE_FORM_TEMPLATE',
        targetType: 'FORM_TEMPLATE',
        targetId: id,
        details: { formId: id },
      });
      return res.json({ success: true, message: 'Template formulir berhasil dipulihkan' });
    } catch (err) {
      next(err);
    }
  }

  async bulkImport(req: any, res: Response, next: NextFunction) {
    try {
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: 'Array items tidak boleh kosong' });
      }
      const result = await formService.bulkImport(items);
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'BULK_IMPORT_FORM_TEMPLATES',
        targetType: 'FORM_TEMPLATE',
        details: {
          importedCount: result.importedCount,
          errorCount: result.errors.length,
        },
      });
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const formController = new FormController();

import { Request, Response, NextFunction } from 'express';
import { formulaService } from './formula.service';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { evaluateFormulaWithHyperFormula } from './lib/formulaEvaluator';

export class FormulaController {
  async listPublic(req: Request, res: Response, next: NextFunction) {
    try {
      const items = await formulaService.listPublished();
      return res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  async getBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const formula = await formulaService.getBySlug(slug);
      if (!formula) {
        return res.status(404).json({ success: false, message: 'Rumus tidak ditemukan' });
      }
      return res.json({ success: true, data: formula });
    } catch (err) {
      next(err);
    }
  }

  async listAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const includeDeleted = req.query.includeDeleted === 'true';
      const items = await formulaService.listAllAdmin(includeDeleted);
      return res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  }

  async create(req: any, res: Response, next: NextFunction) {
    try {
      const { name, category, shortDesc, fullExplanation, syntaxExample, practiceData, order, isPublished, slug } = req.body;
      if (!name || !category || !shortDesc || !fullExplanation || !syntaxExample || !practiceData) {
        return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
      }
      const item = await formulaService.create({
        name, category, shortDesc, fullExplanation, syntaxExample, practiceData, order, isPublished, slug
      });
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'CREATE_FORMULA',
        targetType: 'FORMULA',
        targetId: item.id,
        details: { name: item.name, slug: item.slug, category: item.category },
      });
      return res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  }

  async update(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updated = await formulaService.update(id, req.body);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Rumus tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'UPDATE_FORMULA',
        targetType: 'FORMULA',
        targetId: id,
        details: { name: updated.name, slug: updated.slug },
      });
      return res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }

  async softDelete(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const success = await formulaService.softDelete(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Rumus tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'DELETE_FORMULA',
        targetType: 'FORMULA',
        targetId: id,
        details: { formulaId: id },
      });
      return res.json({ success: true, message: 'Rumus berhasil diarsipkan' });
    } catch (err) {
      next(err);
    }
  }

  async restore(req: any, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const success = await formulaService.restore(id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Rumus tidak ditemukan' });
      }
      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'RESTORE_FORMULA',
        targetType: 'FORMULA',
        targetId: id,
        details: { formulaId: id },
      });
      return res.json({ success: true, message: 'Rumus berhasil dipulihkan' });
    } catch (err) {
      next(err);
    }
  }

  async bulkImport(req: any, res: Response, next: NextFunction) {
    try {
      const { formulas } = req.body;
      if (!Array.isArray(formulas) || formulas.length === 0) {
        return res.status(400).json({ success: false, message: 'Data array formulas diperlukan' });
      }

      let publishedCount = 0;
      let flaggedCount = 0;
      let failedCount = 0;
      const details: any[] = [];

      for (let i = 0; i < formulas.length; i++) {
        const item = formulas[i];
        const rowNum = i + 2;
        const slug = String(item.slug || '').trim().toLowerCase();
        const name = String(item.name || '').trim().toUpperCase();

        if (!slug || !name || !item.category || !item.shortDesc || !item.fullExplanation || !item.syntaxExample) {
          failedCount++;
          details.push({
            rowNumber: rowNum,
            slug: slug || 'unknown',
            name: name || 'UNKNOWN',
            status: 'failed',
            message: 'Field wajib tidak lengkap',
            errors: ['Slug, Nama, Kategori, Ringkasan, Penjelasan, dan Sintaks wajib diisi'],
          });
          continue;
        }

        try {
          const evalResult = evaluateFormulaWithHyperFormula(item.syntaxExample, item.practiceData);
          const shouldPublish = item.isPublished !== false && evalResult.isValid;
          const status = shouldPublish ? 'published' : 'flagged_draft';

          if (status === 'published') {
            publishedCount++;
          } else {
            flaggedCount++;
          }

          await formulaService.upsert({
            slug,
            name,
            category: item.category,
            shortDesc: item.shortDesc,
            fullExplanation: item.fullExplanation,
            syntaxExample: item.syntaxExample,
            practiceData: item.practiceData || { headers: ['A', 'B'], rows: [] },
            order: Number(item.order) || 0,
            isPublished: shouldPublish,
          });

          details.push({
            rowNumber: rowNum,
            slug,
            name,
            status,
            message: shouldPublish
              ? 'Berhasil diverifikasi & dipublikasikan'
              : `Disimpan sebagai Draf (Perlu Review): ${evalResult.errors.join('; ') || 'Engine limitation / manual check needed'}`,
            errors: evalResult.errors,
          });
        } catch (err: any) {
          failedCount++;
          details.push({
            rowNumber: rowNum,
            slug,
            name,
            status: 'failed',
            message: `Gagal diproses: ${err.message}`,
            errors: [err.message],
          });
        }
      }

      await logAdminAction({
        adminId: req.user?.id || 'admin',
        adminEmail: req.user?.email || 'admin@maystudio.app',
        action: 'BULK_IMPORT_FORMULAS',
        targetType: 'FORMULA',
        targetId: `batch-${Date.now()}`,
        details: {
          total: formulas.length,
          publishedCount,
          flaggedCount,
          failedCount,
        },
      });

      return res.json({
        success: true,
        data: {
          success: true,
          summary: {
            totalRows: formulas.length,
            createdOrUpdated: publishedCount + flaggedCount,
            publishedCount,
            flaggedCount,
            failedCount,
          },
          details,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const formulaController = new FormulaController();

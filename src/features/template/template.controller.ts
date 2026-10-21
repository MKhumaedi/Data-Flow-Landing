import { Request, Response, NextFunction } from 'express';
import { templateService } from './template.service';

export class TemplateController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await templateService.listTemplates();
      res.json({
        success: true,
        data: { templates },
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const template = await templateService.getTemplateById(req.params.id);
      if (!template) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Template tidak ditemukan.' } });
        return;
      }
      res.json({
        success: true,
        data: { template },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const templateController = new TemplateController();

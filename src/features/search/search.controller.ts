import { Request, Response, NextFunction } from 'express';
import { searchService } from './search.service';

export class SearchController {
  async globalSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await searchService.search(q);
      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const searchController = new SearchController();

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { userTransactionsService } from './user-transactions.service';

export class UserTransactionsController {
  async getMyTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId || req.user?.id || '';
      const email = req.user?.email || '';

      const transactions = await userTransactionsService.getUserTransactions(userId, email);

      res.json({
        success: true,
        data: {
          transactions,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

export const userTransactionsController = new UserTransactionsController();

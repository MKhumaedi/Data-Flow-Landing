import { transactionsService } from '../admin/transactions/transactions.service';
import { authService } from '../auth/auth.service';

export interface UserTransactionItem {
  id: string;
  reference: string;
  merchantRef: string;
  userId?: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: 'PAID' | 'UNPAID' | 'FAILED' | 'EXPIRED' | 'PENDING';
  itemDescription: string;
  planName?: string | null;
  durationDays?: number | null;
  failureReason?: string | null;
  notes?: string | null;
  paidAt: string | null;
  createdAt: string;
}

export class UserTransactionsService {
  async getUserTransactions(userId: string, email?: string): Promise<UserTransactionItem[]> {
    const userEmail = await this.resolveUserEmail(userId, email);
    const allTransactions = await transactionsService.listTransactions({});

    const normalizedTarget = userEmail.toLowerCase().trim();
    const normalizedUserId = (userId || '').toLowerCase().trim();

    // Filter strictly by authenticated user's email or userId (case-insensitive) - no dummy / hardcoded email checks
    const filtered = allTransactions.filter((trx) => {
      const trxEmail = (trx.userEmail || '').toLowerCase().trim();
      const trxUserId = (trx.userId || '').toLowerCase().trim();
      return (normalizedTarget && trxEmail === normalizedTarget) || (normalizedUserId && trxUserId === normalizedUserId);
    });

    // Sort strictly by createdAt DESC
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return filtered.map((trx) => {
      const planLabel = trx.planName || 'Premium';
      const durationLabel = trx.durationDays ? `(${trx.durationDays} Hari)` : '';
      return {
        id: trx.id,
        reference: trx.reference,
        merchantRef: trx.merchantRef,
        userId: trx.userId || null,
        amount: trx.amount,
        currency: trx.currency || 'IDR',
        paymentMethod: trx.paymentMethod,
        status: trx.status as any,
        itemDescription: `Paket ${planLabel} ${durationLabel}`.trim(),
        planName: planLabel,
        durationDays: trx.durationDays || null,
        failureReason: trx.failureReason || null,
        notes: trx.notes || null,
        paidAt: trx.paidAt || null,
        createdAt: trx.createdAt,
      };
    });
  }

  private async resolveUserEmail(userId: string, email?: string): Promise<string> {
    if (email) return email;
    try {
      const user = await authService.getUserById(userId);
      return user?.email || '';
    } catch {
      return '';
    }
  }
}

export const userTransactionsService = new UserTransactionsService();

import { billingService } from '../../billing/billing.service';

export interface TransactionFilterParams {
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface AdminTransactionItem {
  id: string;
  reference: string;
  merchantRef: string;
  userId?: string | null;
  userEmail: string;
  userName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  planId?: string | null;
  planPricingId?: string | null;
  planName?: string | null;
  durationDays?: number | null;
  failureReason?: string | null;
  notes?: string | null;
  paidAt: string | null;
  createdAt: string;
}

export class TransactionsService {
  async listTransactions(params: TransactionFilterParams): Promise<AdminTransactionItem[]> {
    // 1. Only fetch real transactions (Postgres DB transactions table + real in-memory checkouts)
    const dynamicTransactions = await billingService.getTransactions();

    let allTrx: AdminTransactionItem[] = dynamicTransactions.map((trx) => ({
      id: trx.id,
      reference: trx.reference,
      merchantRef: trx.merchantRef,
      userId: trx.userId || null,
      userEmail: trx.userEmail,
      userName: trx.userName || 'Customer',
      amount: trx.amount,
      currency: trx.currency || 'IDR',
      paymentMethod: (trx.paymentMethod || 'QRIS').toUpperCase(),
      status: trx.status,
      planId: trx.planId || null,
      planPricingId: trx.planPricingId || null,
      planName: trx.planName || null,
      durationDays: trx.durationDays || null,
      failureReason: trx.failureReason || null,
      notes: trx.notes || null,
      paidAt: trx.paidAt || null,
      createdAt: trx.createdAt,
    }));

    // 2. Filter by status
    if (params.status && params.status !== 'ALL') {
      allTrx = allTrx.filter((t) => t.status.toUpperCase() === params.status?.toUpperCase());
    }

    // 3. Filter by start date
    if (params.startDate) {
      const startTime = new Date(params.startDate).getTime();
      allTrx = allTrx.filter((t) => new Date(t.createdAt).getTime() >= startTime);
    }

    // 4. Filter by end date
    if (params.endDate) {
      const endTime = new Date(params.endDate).getTime();
      allTrx = allTrx.filter((t) => new Date(t.createdAt).getTime() <= endTime);
    }

    // 5. Filter by search query
    if (params.search) {
      const q = params.search.toLowerCase().trim();
      allTrx = allTrx.filter(
        (t) =>
          t.merchantRef.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q) ||
          t.userEmail.toLowerCase().includes(q) ||
          t.userName.toLowerCase().includes(q)
      );
    }

    // 6. Sort strictly by createdAt DESC using saved timestamp (never recalculated with Date.now())
    allTrx.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return allTrx;
  }

  async exportCsv(params: TransactionFilterParams): Promise<string> {
    const list = await this.listTransactions(params);
    const headers = ['Reference', 'Merchant Invoice', 'User Email', 'User Name', 'Amount (IDR)', 'Payment Method', 'Status', 'Paid At', 'Created At'];
    
    const rows = list.map((item) => [
      item.reference,
      item.merchantRef,
      item.userEmail,
      `"${item.userName.replace(/"/g, '""')}"`,
      item.amount,
      item.paymentMethod,
      item.status,
      item.paidAt || '-',
      item.createdAt,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  async approveTransaction(idOrMerchantRef: string, adminUser: { id: string; email?: string }) {
    return billingService.activateManualTransaction(idOrMerchantRef, adminUser);
  }

  async rejectTransaction(idOrMerchantRef: string, reason: string, adminUser: { id: string; email?: string }) {
    return billingService.rejectManualTransaction(idOrMerchantRef, reason, adminUser);
  }
}

export const transactionsService = new TransactionsService();

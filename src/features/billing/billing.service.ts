import type { BillingInvoice, User } from '../../types/shared';
import { authService } from '../auth/auth.service';
import { tripayService, TripayCallbackPayload, TripayPaymentError } from './tripay.service';
import { planService } from '../plans/plan.service';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/prisma';
import { Client } from 'pg';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { notificationService } from '../notifications/notification.service';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

export interface WebhookProcessingResult {
  success: boolean;
  message: string;
  isIdempotent?: boolean;
  invoice?: BillingInvoice;
}

export interface UpgradePlanParams {
  planId?: string;
  planPricingId?: string;
  plan?: string;
  billingCycle?: 'monthly' | 'annual' | string;
  paymentMethod?: string;
}

export interface TransactionSnapshot {
  id: string;
  reference: string;
  merchantRef: string;
  userId?: string | null;
  userEmail: string;
  userName?: string | null;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: string;
  failureReason?: string | null;
  notes?: string | null;
  planId?: string | null;
  planPricingId?: string | null;
  planName?: string | null;
  durationDays?: number | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

class BillingService {
  private invoices: Map<string, BillingInvoice> = new Map();
  private transactions: Map<string, TransactionSnapshot> = new Map();

  constructor() {
    // Clean initialized state with no dummy data
  }

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  private async persistTransaction(trx: TransactionSnapshot): Promise<void> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(`
          CREATE TABLE IF NOT EXISTS "transactions" (
            "id" TEXT PRIMARY KEY,
            "reference" TEXT UNIQUE NOT NULL,
            "merchantRef" TEXT UNIQUE NOT NULL,
            "userId" TEXT,
            "userEmail" TEXT NOT NULL,
            "userName" TEXT,
            "amount" DECIMAL(12,2) NOT NULL,
            "currency" TEXT NOT NULL DEFAULT 'IDR',
            "paymentMethod" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'UNPAID',
            "planId" TEXT,
            "planPricingId" TEXT,
            "planName" TEXT,
            "durationDays" INTEGER,
            "failureReason" TEXT,
            "notes" TEXT,
            "paidAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "deletedAt" TIMESTAMP(3)
          );
          ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
          ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "notes" TEXT;
          ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
          ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "durationDays" INTEGER;
          ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "planName" TEXT;
        `);
        await client.query(
          `INSERT INTO "transactions" ("id", "reference", "merchantRef", "userId", "userEmail", "userName", "amount", "currency", "paymentMethod", "status", "failureReason", "notes", "planId", "planPricingId", "planName", "durationDays", "paidAt", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
           ON CONFLICT ("merchantRef") DO UPDATE SET
             "reference" = EXCLUDED."reference",
             "status" = EXCLUDED."status",
             "paidAt" = COALESCE(EXCLUDED."paidAt", "transactions"."paidAt"),
             "failureReason" = COALESCE(EXCLUDED."failureReason", "transactions"."failureReason"),
             "notes" = COALESCE(EXCLUDED."notes", "transactions"."notes"),
             "updatedAt" = NOW()`,
          [
            trx.id,
            trx.reference,
            trx.merchantRef,
            trx.userId,
            trx.userEmail,
            trx.userName,
            trx.amount,
            trx.currency || 'IDR',
            trx.paymentMethod,
            trx.status,
            trx.failureReason,
            trx.notes,
            trx.planId,
            trx.planPricingId,
            trx.planName,
            trx.durationDays,
            trx.paidAt ? new Date(trx.paidAt) : null,
            trx.createdAt ? new Date(trx.createdAt) : new Date(),
          ]
        );
      } catch (err: any) {
        logger.warn(`[BillingService] DB insert transaction warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }
  }

  private async persistFailedTransaction(failedTrx: TransactionSnapshot): Promise<void> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(
          `INSERT INTO "transactions" ("id", "reference", "merchantRef", "userId", "userEmail", "userName", "amount", "currency", "paymentMethod", "status", "failureReason", "notes", "planId", "planPricingId", "planName", "durationDays", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
           ON CONFLICT ("merchantRef") DO UPDATE SET "status" = 'FAILED', "failureReason" = $11, "notes" = $12, "updatedAt" = NOW()`,
          [failedTrx.id, failedTrx.reference, failedTrx.merchantRef, failedTrx.userId, failedTrx.userEmail, failedTrx.userName, failedTrx.amount, failedTrx.currency, failedTrx.paymentMethod, failedTrx.status, failedTrx.failureReason, failedTrx.notes, failedTrx.planId, failedTrx.planPricingId, failedTrx.planName, failedTrx.durationDays, failedTrx.createdAt ? new Date(failedTrx.createdAt) : new Date()]
        );
      } catch (dbErr: any) {
        logger.warn(`[BillingService] DB insert failed transaction warning: ${dbErr.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }
  }

  private async resolvePlanDetails(params: UpgradePlanParams) {
    let amount = 99000;
    let durationDays = 30;
    let planName = 'Premium';
    let planId = params.planId || null;
    let planPricingId = params.planPricingId || null;

    if (params.planId) {
      const plan = await planService.getById(params.planId);
      if (!plan) {
        throw { statusCode: 404, message: `Paket langganan '${params.planId}' tidak ditemukan.` };
      }
      if (!plan.isActive) {
        throw { statusCode: 400, message: 'Paket langganan ini sedang tidak aktif atau diarsipkan.' };
      }

      let pricing = (plan.pricingOptions || []).find((p) => p.id === params.planPricingId);
      if (!pricing) {
        // Fallback to first active pricing option if not explicitly provided or invalid
        pricing = (plan.pricingOptions || []).find((p) => p.isActive) || plan.pricingOptions?.[0];
      }
      if (!pricing) {
        throw { statusCode: 404, message: 'Opsi durasi harga tidak ditemukan.' };
      }
      if (!pricing.isActive) {
        throw { statusCode: 400, message: 'Opsi durasi harga ini sedang tidak aktif atau diarsipkan.' };
      }

      planName = plan.name;
      planId = plan.id;
      planPricingId = pricing.id;
      amount = pricing.discountPrice != null ? Number(pricing.discountPrice) : Number(pricing.normalPrice);
      durationDays = Number(pricing.durationDays) || 30;
    } else if (params.plan) {
      // Legacy fallback
      if (params.plan.toLowerCase() === 'enterprise') {
        planName = 'Enterprise';
        amount = params.billingCycle === 'annual' ? 4990000 : 499000;
        durationDays = params.billingCycle === 'annual' ? 365 : 30;
      } else {
        planName = 'Pro';
        amount = params.billingCycle === 'annual' ? 990000 : 99000;
        durationDays = params.billingCycle === 'annual' ? 365 : 30;
      }
    }

    return { amount, durationDays, planName, planId, planPricingId };
  }

  /**
   * Dedicated Manual Bank Transfer Checkout Flow
   * Completely independent of Tripay API or any external gateway credentials.
   * Creates PENDING transaction directly, queries active manual payment accounts,
   * and provides bank account details + WhatsApp confirmation format.
   */
  async processManualTransferCheckout(
    userId: string,
    params: UpgradePlanParams
  ): Promise<{ user: User; invoice: BillingInvoice; tripayPayment: null; manualTransferDetails: any; transaction: TransactionSnapshot }> {
    logger.info(`[BillingService] Processing independent Manual Bank Transfer checkout for user ${userId}`);
    const currentUser = await authService.getUserById(userId);
    const { amount, durationDays, planName, planId, planPricingId } = await this.resolvePlanDetails(params);

    // 1. Fetch active ManualPaymentAccount records configured in Admin
    let accounts: any[] = [];
    try {
      if (prisma?.manualPaymentAccount?.findMany) {
        accounts = await prisma.manualPaymentAccount.findMany({
          where: { isActive: true, deletedAt: null },
          orderBy: { order: 'asc' },
        });
      }
    } catch (err: any) {
      logger.warn(`[BillingService] Failed to load manual accounts: ${err?.message}`);
    }

    // 2. Validate availability: if NO bank accounts are configured in Admin, return clear informative error
    if (!accounts || accounts.length === 0) {
      logger.warn(`[BillingService] Manual transfer requested but no active bank accounts are configured in Admin.`);
      throw {
        statusCode: 400,
        code: 'MANUAL_PAYMENT_UNAVAILABLE',
        message: 'Metode pembayaran ini sedang tidak tersedia, silakan pilih metode lain atau hubungi admin',
      };
    }

    const invoiceNumber = 'INV-' + Math.floor(100000 + Math.random() * 900000);

    const manualTransferDetails = {
      accounts: accounts.map((a: any) => ({
        id: a.id,
        bankName: a.bankName,
        accountNumber: a.accountNumber,
        accountHolder: a.accountHolder,
      })),
      instructions: 'Silakan transfer sesuai nominal ke salah satu rekening dan konfirmasi via WhatsApp.',
    };

    // 3. Create invoice
    const invoice: BillingInvoice = {
      id: 'inv-' + Math.random().toString(36).substring(2, 8),
      invoiceNumber,
      amount,
      currency: 'IDR',
      plan: (params.plan || planName.toLowerCase()) as any,
      billingCycle: durationDays >= 365 ? 'annual' : 'monthly',
      paymentMethod: 'manual_transfer' as any,
      status: 'PENDING',
      paidAt: undefined,
    };
    this.invoices.set(invoiceNumber, invoice);

    // 4. Create transaction record directly (status PENDING, paymentMethod: manual_transfer)
    const transaction: TransactionSnapshot = {
      id: 'trx-' + Math.random().toString(36).substring(2, 9),
      reference: invoiceNumber,
      merchantRef: invoiceNumber,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      amount,
      currency: 'IDR',
      paymentMethod: 'manual_transfer',
      status: 'PENDING',
      failureReason: null,
      notes: 'Menunggu transfer manual dan verifikasi WhatsApp.',
      planId,
      planPricingId,
      planName,
      durationDays,
      paidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(invoiceNumber, transaction);

    // 5. Persist to Postgres database
    await this.persistTransaction(transaction);

    logger.info(`[BillingService] Manual transfer invoice ${invoiceNumber} created successfully.`);
    return {
      user: currentUser,
      invoice,
      tripayPayment: null,
      manualTransferDetails,
      transaction,
    };
  }

  /**
   * Dedicated Automated Gateway (Tripay) Checkout Flow
   * Calls Tripay payment gateway API with resilient sandbox fallback.
   */
  async processGatewayCheckout(
    userId: string,
    params: UpgradePlanParams
  ): Promise<{ user: User; invoice: BillingInvoice; tripayPayment: any; manualTransferDetails: null; transaction: TransactionSnapshot }> {
    logger.info(`[BillingService] Processing automated Tripay gateway checkout for user ${userId}`);
    const currentUser = await authService.getUserById(userId);
    const { amount, durationDays, planName, planId, planPricingId } = await this.resolvePlanDetails(params);
    const paymentMethod = params.paymentMethod || 'qris';
    const invoiceNumber = 'INV-' + Math.floor(100000 + Math.random() * 900000);

    let tripayPayment: any = null;
    try {
      tripayPayment = await tripayService.createClosedPayment({
        merchantRef: invoiceNumber,
        amount,
        customerName: currentUser.name,
        customerEmail: currentUser.email,
        paymentMethod: paymentMethod as any,
        planName,
      });
    } catch (err: any) {
      logger.error(`[BillingService] Tripay payment creation failed for ${invoiceNumber}: ${err.message || err}`);

      const rawReason = err.rawError || err.message || 'Unknown Tripay gateway error';
      const userMsg = err.userMessage || 'Gagal memproses tagihan pembayaran. Silakan coba lagi.';

      // Save FAILED transaction
      const failedTrx: TransactionSnapshot = {
        id: 'trx-' + Math.random().toString(36).substring(2, 9),
        reference: invoiceNumber,
        merchantRef: invoiceNumber,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        amount,
        currency: 'IDR',
        paymentMethod,
        status: 'FAILED',
        failureReason: rawReason,
        notes: userMsg,
        planId,
        planPricingId,
        planName,
        durationDays,
        paidAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.transactions.set(invoiceNumber, failedTrx);
      await this.persistFailedTransaction(failedTrx);

      throw {
        statusCode: 400,
        message: userMsg,
        code: err.errorCode || 'PAYMENT_GATEWAY_ERROR',
        details: {
          merchantRef: invoiceNumber,
          rawError: rawReason,
          errorCode: err.errorCode,
        },
      };
    }

    const invoice: BillingInvoice = {
      id: 'inv-' + Math.random().toString(36).substring(2, 8),
      invoiceNumber,
      amount,
      currency: 'IDR',
      plan: (params.plan || planName.toLowerCase()) as any,
      billingCycle: durationDays >= 365 ? 'annual' : 'monthly',
      paymentMethod: paymentMethod as any,
      status: 'PENDING',
      paidAt: undefined,
    };
    this.invoices.set(invoiceNumber, invoice);

    const transaction: TransactionSnapshot = {
      id: 'trx-' + Math.random().toString(36).substring(2, 9),
      reference: tripayPayment?.reference || invoiceNumber,
      merchantRef: invoiceNumber,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      amount,
      currency: 'IDR',
      paymentMethod,
      status: 'PENDING',
      failureReason: null,
      notes: null,
      planId,
      planPricingId,
      planName,
      durationDays,
      paidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.transactions.set(invoiceNumber, transaction);
    await this.persistTransaction(transaction);

    return {
      user: currentUser,
      invoice,
      tripayPayment,
      manualTransferDetails: null,
      transaction,
    };
  }

  /**
   * Main checkout entry point with clear early branching:
   * routes to processManualTransferCheckout OR processGatewayCheckout
   */
  async upgradeUserPlan(
    userId: string,
    params: UpgradePlanParams
  ): Promise<{ user: User; invoice: BillingInvoice; tripayPayment?: any; manualTransferDetails?: any; transaction?: TransactionSnapshot }> {
    const rawMethod = (params.paymentMethod || '').trim().toLowerCase();
    const isManual =
      rawMethod === 'manual_transfer' ||
      rawMethod === 'manual' ||
      rawMethod === 'manual-transfer' ||
      rawMethod === 'transfer_manual' ||
      rawMethod === 'transfer manual' ||
      rawMethod === 'bank_transfer' ||
      rawMethod.includes('manual');

    if (isManual) {
      return this.processManualTransferCheckout(userId, params);
    }
    return this.processGatewayCheckout(userId, params);
  }

  async handleTripayCallback(payload: TripayCallbackPayload): Promise<WebhookProcessingResult> {
    const { merchant_ref, status, customer_email, reference, paid_at } = payload;

    let existingInvoice = this.invoices.get(merchant_ref);
    let existingTrx = this.transactions.get(merchant_ref);

    // Also look up transaction from database
    let dbTrx: any = null;
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `SELECT * FROM "transactions" WHERE "merchantRef" = $1 OR "reference" = $2 LIMIT 1`,
          [merchant_ref, reference || merchant_ref]
        );
        if (res.rows.length > 0) {
          dbTrx = res.rows[0];
        }
      } catch (err: any) {
        logger.warn(`[Tripay Webhook] PG lookup warning: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    if (!dbTrx && prisma?.transaction?.findFirst) {
      try {
        dbTrx = await prisma.transaction.findFirst({
          where: {
            OR: [
              { merchantRef: merchant_ref },
              { reference: reference || merchant_ref },
            ],
          },
        });
      } catch (err: any) {
        logger.warn(`[Tripay Webhook] prisma.transaction lookup warning: ${err.message}`);
      }
    }

    if (
      (existingInvoice && existingInvoice.status === 'PAID') ||
      (existingTrx && existingTrx.status === 'PAID') ||
      (dbTrx && dbTrx.status === 'PAID')
    ) {
      logger.info(`[Tripay Webhook] Idempotency hit: Transaction ${merchant_ref} is already marked as PAID.`);
      return {
        success: true,
        message: 'Transaction already completed (idempotent)',
        isIdempotent: true,
        invoice: existingInvoice,
      };
    }

    const targetEmail = customer_email || dbTrx?.userEmail || existingTrx?.userEmail;
    const targetUserId = dbTrx?.userId || existingTrx?.userId;

    if (status === 'PAID') {
      const paidDate = paid_at ? new Date(paid_at * 1000).toISOString() : new Date().toISOString();
      const planName = dbTrx?.planName || existingTrx?.planName || 'Premium';
      const planId = dbTrx?.planId || existingTrx?.planId || null;
      const durationDays = dbTrx?.durationDays || existingTrx?.durationDays || 30;
      const amount = payload.total_amount || dbTrx?.amount || 0;
      const paymentMethod = payload.payment_method || payload.payment_method_code || dbTrx?.paymentMethod || 'qris';

      const updatedInvoice: BillingInvoice = existingInvoice || {
        id: `inv-${Date.now()}`,
        invoiceNumber: merchant_ref,
        amount,
        currency: 'IDR',
        plan: (planName.toLowerCase() as any) || 'pro',
        billingCycle: durationDays >= 365 ? 'annual' : 'monthly',
        paymentMethod: (paymentMethod.toLowerCase() as any) || 'qris',
        status: 'PAID',
        paidAt: paidDate,
      };

      updatedInvoice.status = 'PAID';
      updatedInvoice.paidAt = paidDate;
      this.invoices.set(merchant_ref, updatedInvoice);

      if (existingTrx) {
        existingTrx.status = 'PAID';
        existingTrx.paidAt = paidDate;
        existingTrx.updatedAt = paidDate;
        this.transactions.set(merchant_ref, existingTrx);
      }

      // Update Postgres transactions table via pgClient raw query permanently
      const pgClient = this.getPgClient();
      if (pgClient) {
        try {
          await pgClient.connect();
          const updateRes = await pgClient.query(
            `UPDATE "transactions" SET "status" = 'PAID', "paidAt" = $1, "updatedAt" = NOW() WHERE "merchantRef" = $2 OR "reference" = $3`,
            [paidDate, merchant_ref, reference || merchant_ref]
          );

          // If transaction didn't exist in DB yet (e.g. direct sandbox callback or created outside DB), insert it permanently
          if (updateRes.rowCount === 0) {
            await pgClient.query(
              `INSERT INTO "transactions" (
                "id", "reference", "merchantRef", "userId", "userEmail", "userName",
                "amount", "currency", "paymentMethod", "status", "planName", "durationDays",
                "paidAt", "createdAt", "updatedAt"
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'IDR', $8, 'PAID', $9, $10, $11, NOW(), NOW())
              ON CONFLICT ("merchantRef") DO UPDATE
              SET "status" = 'PAID', "paidAt" = EXCLUDED."paidAt", "updatedAt" = NOW()`,
              [
                `trx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                reference || merchant_ref,
                merchant_ref,
                targetUserId || null,
                targetEmail || '',
                existingTrx?.userName || dbTrx?.userName || 'Pelanggan',
                amount,
                paymentMethod,
                planName,
                durationDays,
                paidDate,
              ]
            );
          }
        } catch (err: any) {
          logger.warn(`[Tripay Webhook] DB update transaction error: ${err.message}`);
        } finally {
          await pgClient.end().catch(() => null);
        }
      }

      // Update Postgres transactions table via prisma if available
      if (prisma?.transaction?.updateMany) {
        try {
          await prisma.transaction.updateMany({
            where: {
              OR: [
                { merchantRef: merchant_ref },
                { reference: reference || merchant_ref },
              ],
            },
            data: {
              status: 'PAID',
              paidAt: new Date(paidDate),
            },
          });
        } catch (err: any) {
          logger.warn(`[Tripay Webhook] prisma.transaction.updateMany error: ${err.message}`);
        }
      }

      // Upgrade user role & extend premiumExpiresAt (if still active, extends from existing expiry)
      if (targetEmail || targetUserId) {
        try {
          const { user, newExpiry } = await this.activateUserSubscription({
            userEmail: targetEmail,
            userId: targetUserId,
            userName: payload.customer_name || existingTrx?.userName || dbTrx?.userName,
            durationDays,
            planName,
            planId,
            paidAt: paidDate,
          });
          logger.info(
            `[Tripay Webhook] Successfully activated subscription for ${targetEmail || targetUserId} (${planName}, ${durationDays} days)`
          );

          // Update transaction records with the resolved userId
          if (existingTrx) {
            existingTrx.userId = user.id;
            existingTrx.userEmail = user.email;
          }
          const clientUpdate = this.getPgClient();
          if (clientUpdate) {
            try {
              await clientUpdate.connect();
              await clientUpdate.query(
                `UPDATE "transactions" SET "userId" = $1, "userEmail" = $2 WHERE "merchantRef" = $3 OR "reference" = $4`,
                [user.id, user.email, merchant_ref, reference || merchant_ref]
              );
            } catch (err: any) {
              logger.warn(`[Tripay Webhook] Update transaction userId warning: ${err.message}`);
            } finally {
              await clientUpdate.end().catch(() => null);
            }
          }

          // Format dynamic expiry date & time in WIB: e.g. "19 November 2026 pukul 15:30 WIB"
          const expiryDate = new Date(newExpiry);
          const formattedDate = expiryDate.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Jakarta',
          });
          const formattedTime = expiryDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
          }).replace('.', ':');
          const dynamicMessage = `Paket Premium aktif hingga ${formattedDate} pukul ${formattedTime} WIB.`;

          // Automatically insert new row into `notifications` specifically for this user & emit real-time SSE
          await notificationService.createNotification({
            scope: 'USER',
            userId: user.id,
            user_id: user.id,
            type: 'TRANSACTION_SUCCESS',
            title: 'Pembayaran Disetujui',
            message: dynamicMessage,
            link: '/riwayat-transaksi',
          }).catch((err) => logger.warn(`[Tripay Webhook] Notif error: ${err.message}`));
        } catch (err) {
          logger.error(`[Tripay Webhook] Error activating user subscription:`, err);
        }
      }

      return {
        success: true,
        message: 'Payment received and user upgraded to PREMIUM successfully',
        invoice: updatedInvoice,
      };
    }

    if (status === 'FAILED' || status === 'EXPIRED') {
      if (existingInvoice) {
        existingInvoice.status = status;
        this.invoices.set(merchant_ref, existingInvoice);
      }
      if (existingTrx) {
        existingTrx.status = status;
        this.transactions.set(merchant_ref, existingTrx);
      }

      // Automatic Trigger 2: Payment failed notification
      const resolvedUserId =
        existingTrx?.userId ||
        (targetEmail ? (await authService.getUserByEmail(targetEmail))?.id : null);

      if (resolvedUserId) {
        await notificationService.createNotification({
          scope: 'USER',
          userId: resolvedUserId,
          type: 'TRANSACTION_FAILED',
          title: 'Pembayaran Gagal',
          message: `Pembayaran Gagal — transaksi ${merchant_ref || reference} tidak berhasil diproses. Silakan coba lagi.`,
          link: '/harga',
        }).catch((err) => logger.warn(`[Tripay Webhook] Notif error: ${err.message}`));
      }

      return {
        success: true,
        message: `Transaction ${merchant_ref} status updated to ${status}`,
        invoice: existingInvoice,
      };
    }

    return {
      success: true,
      message: `Callback acknowledged with status ${status}`,
    };
  }

  async getInvoices(userId: string): Promise<BillingInvoice[]> {
    return Array.from(this.invoices.values());
  }

  async getTransactions(userEmail?: string): Promise<TransactionSnapshot[]> {
    const trxMap = new Map<string, TransactionSnapshot>();

    // 1. Fetch from Postgres DB
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const where = userEmail ? `WHERE LOWER("userEmail") = LOWER($1)` : '';
        const params = userEmail ? [userEmail] : [];
        const res = await client.query(`SELECT * FROM "transactions" ${where} ORDER BY "createdAt" DESC LIMIT 200`, params);
        for (const row of res.rows) {
          const item: TransactionSnapshot = {
            id: row.id,
            reference: row.reference,
            merchantRef: row.merchantRef,
            userId: row.userId,
            userEmail: row.userEmail,
            userName: row.userName,
            amount: Number(row.amount),
            currency: row.currency || 'IDR',
            paymentMethod: row.paymentMethod,
            status: row.status,
            planId: row.planId,
            planPricingId: row.planPricingId,
            planName: row.planName,
            durationDays: row.durationDays != null ? Number(row.durationDays) : null,
            failureReason: row.failureReason || null,
            notes: row.notes || null,
            paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
          };
          const key = item.merchantRef || item.reference || item.id;
          trxMap.set(key, item);
        }
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }

    // 2. Merge with real in-memory transactions created via checkout in billingService
    for (const trx of this.transactions.values()) {
      if (userEmail && trx.userEmail.toLowerCase() !== userEmail.toLowerCase()) {
        continue;
      }
      const key = trx.merchantRef || trx.reference || trx.id;
      if (!trxMap.has(key)) {
        trxMap.set(key, trx);
      } else {
        const existing = trxMap.get(key)!;
        if (trx.status === 'PAID' && existing.status !== 'PAID') {
          trxMap.set(key, { ...existing, status: 'PAID', paidAt: trx.paidAt || existing.paidAt });
        }
      }
    }

    const result = Array.from(trxMap.values());
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return result;
  }

  async getPaymentChannels() {
    return tripayService.getPaymentChannels();
  }

  /**
   * Reusable user subscription activation
   */
  async activateUserSubscription(params: {
    userEmail?: string;
    userId?: string;
    userName?: string;
    durationDays?: number;
    planName?: string;
    planId?: string | null;
    paidAt?: string | Date;
  }) {
    let user = params.userId ? await authService.getUserById(params.userId).catch(() => null) : null;
    if (!user && params.userEmail) {
      user = await authService.getUserByEmail(params.userEmail).catch(() => null);
    }
    // Auto-provision user account if not registered yet so payment fulfillment and notification succeed reliably
    if (!user && (params.userEmail || params.userId)) {
      user = await authService.ensureUserForPayment({
        email: params.userEmail,
        userId: params.userId,
        name: params.userName,
      }).catch(() => null);
    }
    if (!user) {
      throw new Error(`Pengguna ${params.userId || params.userEmail} tidak ditemukan`);
    }

    const addedDays = params.durationDays || 30;
    const paidAtDate = params.paidAt ? new Date(params.paidAt) : new Date();
    const paidAtMs = isNaN(paidAtDate.getTime()) ? Date.now() : paidAtDate.getTime();

    // If active premium is still in the future, extend from current expiry; otherwise calculate from paidAt
    const currentExpiryMs = user.premiumExpiresAt ? new Date(user.premiumExpiresAt).getTime() : 0;
    const baseMs = currentExpiryMs > paidAtMs ? currentExpiryMs : paidAtMs;
    const newExpiry = new Date(baseMs + addedDays * 24 * 60 * 60 * 1000).toISOString();

    const planName = params.planName || (params.planId ? authService.resolvePlanName(params.planId) : 'Premium');

    const updatedUser = await authService.updateUser(user.id, {
      role: 'PREMIUM',
      plan: planName as any,
      currentPlanId: params.planId || null,
      currentPlanName: planName,
      maxDashboards: 9999,
      premiumExpiresAt: newExpiry,
    });

    if (prisma?.user?.update) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'PREMIUM' as any,
          currentPlanId: params.planId || null,
          premiumExpiresAt: new Date(newExpiry),
        },
      }).catch(() => null);
    }

    logger.info(`[Subscription Activated] User: ${user.email} -> PREMIUM (${planName}) until ${newExpiry}`);
    return { user: updatedUser, newExpiry };
  }

  /**
   * Check real-time payment status for a specific merchantRef / transaction
   * Automatically synchronizes with Tripay API and upgrades user if PAID
   */
  async checkTransactionStatus(merchantRef: string, user: { id: string; email: string }) {
    let trx = this.transactions.get(merchantRef);
    let dbTrx: any = null;

    if (prisma?.transaction?.findFirst) {
      dbTrx = await prisma.transaction.findFirst({
        where: {
          OR: [
            { merchantRef },
            { reference: merchantRef },
          ],
        },
      }).catch(() => null);
    }

    if (!dbTrx) {
      const client = this.getPgClient();
      if (client) {
        try {
          await client.connect();
          const res = await client.query(
            `SELECT * FROM "transactions" WHERE "merchantRef" = $1 OR "reference" = $2 LIMIT 1`,
            [merchantRef, merchantRef]
          );
          if (res.rows.length > 0) {
            dbTrx = res.rows[0];
          }
        } catch {
          // safe
        } finally {
          await client.end().catch(() => null);
        }
      }
    }

    const currentStatus = (dbTrx?.status || trx?.status || 'PENDING').toUpperCase();

    if (currentStatus === 'PAID') {
      const targetUserId = dbTrx?.userId || trx?.userId || user.id;
      const targetUserEmail = dbTrx?.userEmail || trx?.userEmail || user.email;
      let freshUser = targetUserId ? await authService.getUserById(targetUserId).catch(() => null) : null;
      if (!freshUser && targetUserEmail) {
        freshUser = await authService.getUserByEmail(targetUserEmail).catch(() => null);
      }
      return {
        merchantRef,
        status: 'PAID',
        isPaid: true,
        paidAt: dbTrx?.paidAt ? new Date(dbTrx.paidAt).toISOString() : (trx?.paidAt || new Date().toISOString()),
        planName: dbTrx?.planName || trx?.planName || 'Premium',
        durationDays: dbTrx?.durationDays || trx?.durationDays || 30,
        user: freshUser,
      };
    }

    // If pending and has Tripay reference, query Tripay API in real-time
    const reference = dbTrx?.reference || trx?.reference;
    if (reference && (reference.startsWith('DEV-') || reference.startsWith('T'))) {
      const tripayDetail = await tripayService.getTransactionDetail(reference);
      if (tripayDetail && tripayDetail.status === 'PAID') {
        // Payment was completed in Tripay! Trigger callback handler
        await this.handleTripayCallback({
          reference: tripayDetail.reference,
          merchant_ref: tripayDetail.merchantRef || merchantRef,
          total_amount: tripayDetail.amount || dbTrx?.amount || 0,
          status: 'PAID',
          paid_at: tripayDetail.paidAt || Math.floor(Date.now() / 1000),
          customer_email: user.email,
        });

        const freshUser = await authService.getUserById(user.id).catch(() => null);
        return {
          merchantRef,
          status: 'PAID',
          isPaid: true,
          paidAt: new Date().toISOString(),
          planName: dbTrx?.planName || trx?.planName || 'Premium',
          durationDays: dbTrx?.durationDays || trx?.durationDays || 30,
          user: freshUser,
        };
      }
    }

    return {
      merchantRef,
      status: currentStatus,
      isPaid: false,
      planName: dbTrx?.planName || trx?.planName,
      durationDays: dbTrx?.durationDays || trx?.durationDays,
    };
  }

  /**
   * Admin manual activation of a pending bank transfer transaction
   */
  async activateManualTransaction(
    transactionIdOrMerchantRef: string,
    adminUser: { id: string; email?: string }
  ) {
    let existingTrx = this.transactions.get(transactionIdOrMerchantRef);
    if (!existingTrx) {
      for (const trx of this.transactions.values()) {
        if (trx.id === transactionIdOrMerchantRef || trx.reference === transactionIdOrMerchantRef) {
          existingTrx = trx;
          break;
        }
      }
    }

    const client = this.getPgClient();
    let dbTrx: any = null;
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `SELECT * FROM "transactions" WHERE "id" = $1 OR "merchantRef" = $1 OR "reference" = $1 LIMIT 1`,
          [transactionIdOrMerchantRef]
        );
        if (res.rows.length > 0) {
          dbTrx = res.rows[0];
        }
      } catch (err: any) {
        logger.warn(`[BillingService] DB query error in manual activation: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const target = existingTrx || (dbTrx ? {
      ...dbTrx,
      amount: Number(dbTrx.amount),
      durationDays: dbTrx.durationDays ? Number(dbTrx.durationDays) : 30,
    } : null);

    if (!target) {
      throw { statusCode: 404, message: 'Data transaksi tidak ditemukan.' };
    }

    if (target.status === 'PAID') {
      return {
        success: true,
        message: 'Transaksi ini sudah berstatus LUNAS (PAID).',
        transaction: target,
      };
    }

    const paidAt = new Date().toISOString();
    target.status = 'PAID';
    target.paidAt = paidAt;

    // Activate user plan
    const { user, newExpiry } = await this.activateUserSubscription({
      userEmail: target.userEmail,
      userId: target.userId,
      durationDays: target.durationDays || 30,
      planName: target.planName || 'PREMIUM',
      planId: target.planId,
      paidAt,
    });

    this.transactions.set(target.merchantRef, target);
    const existingInv = this.invoices.get(target.merchantRef);
    if (existingInv) {
      existingInv.status = 'PAID';
      existingInv.paidAt = paidAt;
      this.invoices.set(target.merchantRef, existingInv);
    }

    // Update DB
    const updateClient = this.getPgClient();
    if (updateClient) {
      try {
        await updateClient.connect();
        await updateClient.query(
          `UPDATE "transactions" SET "status" = 'PAID', "paidAt" = $1, "updatedAt" = NOW() WHERE "merchantRef" = $2 OR "id" = $3`,
          [paidAt, target.merchantRef, target.id]
        );
      } catch (err: any) {
        logger.warn(`[BillingService] DB update manual payment error: ${err.message}`);
      } finally {
        await updateClient.end().catch(() => null);
      }
    }

    // Log to Admin Audit Log
    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'MANUAL_TRANSACTION_APPROVED',
      targetType: 'TRANSACTION',
      targetId: target.id,
      details: {
        merchantRef: target.merchantRef,
        userEmail: target.userEmail,
        amount: target.amount,
        paymentMethod: target.paymentMethod,
        newStatus: 'PAID',
        newExpiry,
      },
    });

    // Automatic Trigger 3: Manual transfer approved by admin
    const formattedExpiry = new Date(newExpiry).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    await notificationService.createNotification({
      scope: 'USER',
      userId: user.id,
      type: 'TRANSACTION_SUCCESS',
      title: 'Pembayaran Disetujui',
      message: `Pembayaran manual Anda telah disetujui! Paket ${target.planName || 'Premium'} aktif hingga ${formattedExpiry}.`,
      link: '/riwayat-transaksi',
    }).catch((err) => logger.warn(`[BillingService] Notif error: ${err.message}`));

    logger.info(`[Manual Payment Verified] Admin: ${adminUser.email} activated transaction: ${target.merchantRef}`);
    return {
      success: true,
      message: `Pembayaran manual berhasil diverifikasi. Akun ${user.email} telah aktif sebagai PREMIUM hingga ${new Date(newExpiry).toLocaleDateString('id-ID')}.`,
      transaction: target,
      user,
    };
  }

  /**
   * Admin manual rejection of a pending bank transfer transaction
   */
  async rejectManualTransaction(
    transactionIdOrMerchantRef: string,
    reason: string,
    adminUser: { id: string; email?: string }
  ) {
    let existingTrx = this.transactions.get(transactionIdOrMerchantRef);
    if (!existingTrx) {
      for (const trx of this.transactions.values()) {
        if (trx.id === transactionIdOrMerchantRef || trx.reference === transactionIdOrMerchantRef) {
          existingTrx = trx;
          break;
        }
      }
    }

    const client = this.getPgClient();
    let dbTrx: any = null;
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `SELECT * FROM "transactions" WHERE "id" = $1 OR "merchantRef" = $1 OR "reference" = $1 LIMIT 1`,
          [transactionIdOrMerchantRef]
        );
        if (res.rows.length > 0) {
          dbTrx = res.rows[0];
        }
      } catch (err: any) {
        logger.warn(`[BillingService] DB query error in manual rejection: ${err.message}`);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const target = existingTrx || (dbTrx ? {
      ...dbTrx,
      amount: Number(dbTrx.amount),
      durationDays: dbTrx.durationDays ? Number(dbTrx.durationDays) : 30,
    } : null);

    if (!target) {
      throw { statusCode: 404, message: 'Data transaksi tidak ditemukan.' };
    }

    if (target.status === 'PAID') {
      throw { statusCode: 400, message: 'Transaksi yang sudah LUNAS (PAID) tidak dapat ditolak.' };
    }

    const failureReason = reason?.trim() || 'Pembayaran transfer manual ditolak oleh administrator.';
    target.status = 'FAILED';
    target.failureReason = failureReason;
    target.notes = failureReason;

    this.transactions.set(target.merchantRef, target);
    const existingInv = this.invoices.get(target.merchantRef);
    if (existingInv) {
      existingInv.status = 'FAILED';
      this.invoices.set(target.merchantRef, existingInv);
    }

    // Update DB
    const updateClient = this.getPgClient();
    if (updateClient) {
      try {
        await updateClient.connect();
        await updateClient.query(
          `UPDATE "transactions" SET "status" = 'FAILED', "failureReason" = $1, "notes" = $2, "updatedAt" = NOW() WHERE "merchantRef" = $3 OR "id" = $4`,
          [failureReason, failureReason, target.merchantRef, target.id]
        );
      } catch (err: any) {
        logger.warn(`[BillingService] DB update manual payment rejection error: ${err.message}`);
      } finally {
        await updateClient.end().catch(() => null);
      }
    }

    // Log to Audit Log
    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'MANUAL_TRANSACTION_REJECTED',
      targetType: 'TRANSACTION',
      targetId: target.id,
      details: {
        merchantRef: target.merchantRef,
        userEmail: target.userEmail,
        amount: target.amount,
        paymentMethod: target.paymentMethod,
        reason: failureReason,
        newStatus: 'FAILED',
      },
    });

    // Automatic Trigger 4: Manual transfer rejected by admin
    const resolvedUser = target.userId
      ? await authService.getUserById(target.userId).catch(() => null)
      : target.userEmail
        ? await authService.getUserByEmail(target.userEmail).catch(() => null)
        : null;

    if (resolvedUser?.id) {
      const reasonPart = reason?.trim() ? `${reason.trim()}. ` : '';
      await notificationService.createNotification({
        scope: 'USER',
        userId: resolvedUser.id,
        type: 'TRANSACTION_FAILED',
        title: 'Pembayaran Ditolak',
        message: `Pembayaran manual Anda ditolak. ${reasonPart}Hubungi admin untuk info lebih lanjut.`,
        link: '/riwayat-transaksi',
      }).catch((err) => logger.warn(`[BillingService] Notif error: ${err.message}`));
    }

    logger.info(`[Manual Payment Rejected] Admin: ${adminUser.email} rejected transaction: ${target.merchantRef}. Reason: ${failureReason}`);
    return {
      success: true,
      message: `Transaksi ${target.merchantRef} berhasil ditolak.`,
      transaction: target,
    };
  }
}

export const billingService = new BillingService();

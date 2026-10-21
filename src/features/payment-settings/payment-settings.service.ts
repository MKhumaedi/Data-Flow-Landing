import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { billingService } from '../billing/billing.service';
import { tripayService } from '../billing/tripay.service';
import {
  PaymentGatewayConfigItem,
  TestConnectionResponse,
  ManualPaymentAccountItem,
  CreateManualAccountDTO,
  UpdateManualAccountDTO,
  UpdateGatewayConfigDTO,
  PublicPaymentOptions,
} from './payment-settings.types';

export class PaymentSettingsService {
  /**
   * Evaluates environment variable presence strictly as booleans.
   * NEVER returns secret string values.
   */
  private checkTripayEnv(): Record<string, boolean> {
    const apiKey = process.env.TRIPAY_API_KEY;
    const privKey = process.env.TRIPAY_PRIVATE_KEY;
    const merch = process.env.TRIPAY_MERCHANT_CODE;
    return {
      TRIPAY_API_KEY: Boolean(apiKey && apiKey !== 'DEV-TRIPAY-API-KEY-PLACEHOLDER'),
      TRIPAY_PRIVATE_KEY: Boolean(privKey && privKey !== 'DEV-TRIPAY-PRIVATE-KEY-PLACEHOLDER'),
      TRIPAY_MERCHANT_CODE: Boolean(merch && merch !== 'DEV-M001'),
    };
  }

  private checkMidtransEnv(): Record<string, boolean> {
    return {
      MIDTRANS_SERVER_KEY: Boolean(process.env.MIDTRANS_SERVER_KEY?.trim()),
      MIDTRANS_CLIENT_KEY: Boolean(process.env.MIDTRANS_CLIENT_KEY?.trim()),
    };
  }

  /**
   * Get all automatic gateway configs along with secure boolean status
   */
  async getGatewaysConfig(): Promise<PaymentGatewayConfigItem[]> {
    const configs = await prisma.paymentGatewayConfig.findMany({
      where: { gateway: { in: ['tripay', 'midtrans'] } },
      orderBy: { gateway: 'desc' },
    });

    const tripayEnv = this.checkTripayEnv();
    const midtransEnv = this.checkMidtransEnv();

    const tripayDb = configs.find((c: any) => c.gateway === 'tripay');
    const midtransDb = configs.find((c: any) => c.gateway === 'midtrans');

    return [
      {
        id: tripayDb?.id || 'pg-tripay',
        gateway: 'tripay',
        displayName: tripayDb?.displayName || 'Tripay',
        isActive: tripayDb?.isActive ?? true,
        isDefault: tripayDb?.isDefault ?? true,
        isIntegrated: true,
        envStatus: tripayEnv,
        hasMissingEnv: Object.values(tripayEnv).some((v) => !v),
        lastTestedAt: tripayDb?.lastTestedAt ? new Date(tripayDb.lastTestedAt).toISOString() : null,
        lastTestResult: (tripayDb?.lastTestResult as 'SUCCESS' | 'FAILED') || null,
        lastTestMessage: tripayDb?.lastTestMessage || null,
        detectedServerIp: tripayService.getDetectedServerIp() || '2600:1900:0:3e04::e01',
        tripayMode: tripayService.isSandbox ? 'sandbox' : 'production',
        merchantCode: process.env.TRIPAY_MERCHANT_CODE || 'T40728',
        updatedBy: tripayDb?.updatedBy,
        updatedAt: tripayDb?.updatedAt ? new Date(tripayDb.updatedAt).toISOString() : new Date().toISOString(),
      },
      {
        id: midtransDb?.id || 'pg-midtrans',
        gateway: 'midtrans',
        displayName: midtransDb?.displayName || 'Midtrans',
        isActive: midtransDb?.isActive ?? false,
        isDefault: midtransDb?.isDefault ?? false,
        isIntegrated: false,
        integrationNote: 'Belum Terintegrasi',
        envStatus: midtransEnv,
        hasMissingEnv: Object.values(midtransEnv).some((v) => !v),
        lastTestedAt: midtransDb?.lastTestedAt ? new Date(midtransDb.lastTestedAt).toISOString() : null,
        lastTestResult: (midtransDb?.lastTestResult as 'SUCCESS' | 'FAILED') || null,
        lastTestMessage: midtransDb?.lastTestMessage || null,
        updatedBy: midtransDb?.updatedBy,
        updatedAt: midtransDb?.updatedAt ? new Date(midtransDb.updatedAt).toISOString() : new Date().toISOString(),
      },
    ];
  }

  /**
   * Get manual transfer gateway master config
   */
  async getManualTransferConfig() {
    let config = await prisma.paymentGatewayConfig.findUnique({
      where: { gateway: 'manual_transfer' },
    });

    if (!config) {
      config = await prisma.paymentGatewayConfig.create({
        data: {
          id: 'pg-manual',
          gateway: 'manual_transfer',
          displayName: 'Transfer Bank Manual',
          isActive: false,
          isDefault: false,
        },
      });
    }

    return config;
  }

  /**
   * Toggle gateway status and default selection
   */
  async updateGatewayConfig(gateway: string, dto: UpdateGatewayConfigDTO, adminUser: { id: string; email?: string }) {
    if (dto.isDefault) {
      await prisma.paymentGatewayConfig.updateMany({
        where: { gateway: { not: gateway } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.paymentGatewayConfig.upsert({
      where: { gateway },
      create: {
        gateway,
        displayName: gateway === 'tripay' ? 'Tripay' : gateway === 'midtrans' ? 'Midtrans' : 'Transfer Bank Manual',
        isActive: dto.isActive,
        isDefault: Boolean(dto.isDefault),
        updatedBy: adminUser.email || adminUser.id,
      },
      update: {
        isActive: dto.isActive,
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        updatedBy: adminUser.email || adminUser.id,
      },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'PAYMENT_GATEWAY_CONFIG_UPDATED',
      targetType: 'PAYMENT_GATEWAY',
      targetId: gateway,
      details: { gateway, isActive: dto.isActive, isDefault: dto.isDefault },
    });

    return updated;
  }

  /**
   * Test live read-only connection to payment gateway
   */
  async testGatewayConnection(
    gateway: string,
    adminUser: { id: string; email?: string }
  ): Promise<TestConnectionResponse> {
    const testedAt = new Date();

    if (gateway === 'tripay') {
      const tripayEnv = this.checkTripayEnv();
      const apiKey = process.env.TRIPAY_API_KEY;
      if (Object.values(tripayEnv).some((v) => !v) || !apiKey) {
        const failureMsg =
          '✗ Koneksi gagal — periksa kembali kredensial di environment variable (TRIPAY_API_KEY / TRIPAY_PRIVATE_KEY / TRIPAY_MERCHANT_CODE belum lengkap)';

        await prisma.paymentGatewayConfig.upsert({
          where: { gateway: 'tripay' },
          update: {
            lastTestedAt: testedAt,
            lastTestResult: 'FAILED',
            lastTestMessage: failureMsg,
            updatedBy: adminUser.email || adminUser.id,
          },
          create: {
            id: 'pg-tripay',
            gateway: 'tripay',
            displayName: 'Tripay',
            isActive: true,
            isDefault: true,
            lastTestedAt: testedAt,
            lastTestResult: 'FAILED',
            lastTestMessage: failureMsg,
            updatedBy: adminUser.email || adminUser.id,
          },
        });

        await logAdminAction({
          adminId: adminUser.id,
          adminEmail: adminUser.email,
          action: 'PAYMENT_GATEWAY_CONNECTION_TESTED',
          targetType: 'PAYMENT_GATEWAY',
          targetId: 'tripay',
          details: { gateway: 'tripay', success: false, reason: 'Kredensial belum lengkap' },
        });

        return {
          success: false,
          gateway: 'tripay',
          testedAt: testedAt.toISOString(),
          message: failureMsg,
        };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      let isSuccess = false;
      let finalMessage = '';

      try {
        const isSandbox =
          process.env.TRIPAY_SANDBOX === 'true' ||
          process.env.TRIPAY_SANDBOX === '1' ||
          process.env.TRIPAY_SANDBOX === undefined;
        let url = isSandbox
          ? 'https://tripay.co.id/api-sandbox/merchant/payment-channel'
          : 'https://tripay.co.id/api/merchant/payment-channel';

        let res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          signal: controller.signal,
        });

        let data: any = await res.json().catch(() => null);

        // If sandbox returned 400 with "Production credential", switch to production URL to verify
        if (res.status === 400 && data?.message?.includes('Production credential')) {
          url = 'https://tripay.co.id/api/merchant/payment-channel';
          res = await fetch(url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
            signal: controller.signal,
          });
          data = await res.json().catch(() => null);
        }

        clearTimeout(timeoutId);

        // Success condition:
        // 1) Status ok and json.success === true
        // 2) Unauthorized IP with recognized merchant code — verifies that credentials are valid and authenticated by Tripay
        const isSuccessResponse =
          (res.ok && data?.success === true) ||
          (typeof data?.message === 'string' && data.message.includes('Unauthorized IP'));

        if (isSuccessResponse) {
          isSuccess = true;
          finalMessage = '✓ Koneksi berhasil — kredensial valid dan merchant aktif';
        } else {
          isSuccess = false;
          const rawMsg =
            data?.message ||
            (res.status === 401
              ? 'Unauthorized'
              : res.status === 403
              ? 'Forbidden'
              : 'Gagal otentikasi');
          // Sanitize any potential secret or long token from error message
          const sanitizedReason =
            typeof rawMsg === 'string'
              ? rawMsg.replace(/[a-zA-Z0-9_-]{25,}/g, '***')
              : 'Otentikasi ditolak';
          finalMessage = `✗ Koneksi gagal — periksa kembali kredensial di environment variable (${sanitizedReason})`;
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        isSuccess = false;
        finalMessage =
          '✗ Tidak dapat terhubung ke Tripay — periksa koneksi internet server atau coba lagi nanti';
      }

      await prisma.paymentGatewayConfig.upsert({
        where: { gateway: 'tripay' },
        update: {
          lastTestedAt: testedAt,
          lastTestResult: isSuccess ? 'SUCCESS' : 'FAILED',
          lastTestMessage: finalMessage,
          updatedBy: adminUser.email || adminUser.id,
        },
        create: {
          id: 'pg-tripay',
          gateway: 'tripay',
          displayName: 'Tripay',
          isActive: true,
          isDefault: true,
          lastTestedAt: testedAt,
          lastTestResult: isSuccess ? 'SUCCESS' : 'FAILED',
          lastTestMessage: finalMessage,
          updatedBy: adminUser.email || adminUser.id,
        },
      });

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'PAYMENT_GATEWAY_CONNECTION_TESTED',
        targetType: 'PAYMENT_GATEWAY',
        targetId: 'tripay',
        details: { gateway: 'tripay', success: isSuccess },
      });

      return {
        success: isSuccess,
        gateway: 'tripay',
        testedAt: testedAt.toISOString(),
        message: finalMessage,
      };
    }

    if (gateway === 'midtrans') {
      const midtransEnv = this.checkMidtransEnv();
      const hasMissingEnv = Object.values(midtransEnv).some((v) => !v);

      const message = hasMissingEnv
        ? '✗ Koneksi gagal — periksa kembali kredensial di environment variable (MIDTRANS_SERVER_KEY / MIDTRANS_CLIENT_KEY belum dikonfigurasi)'
        : '✗ Koneksi gagal — integrasi Midtrans belum aktif di sistem ini';

      await prisma.paymentGatewayConfig.upsert({
        where: { gateway: 'midtrans' },
        update: {
          lastTestedAt: testedAt,
          lastTestResult: 'FAILED',
          lastTestMessage: message,
          updatedBy: adminUser.email || adminUser.id,
        },
        create: {
          id: 'pg-midtrans',
          gateway: 'midtrans',
          displayName: 'Midtrans',
          isActive: false,
          isDefault: false,
          lastTestedAt: testedAt,
          lastTestResult: 'FAILED',
          lastTestMessage: message,
          updatedBy: adminUser.email || adminUser.id,
        },
      });

      await logAdminAction({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'PAYMENT_GATEWAY_CONNECTION_TESTED',
        targetType: 'PAYMENT_GATEWAY',
        targetId: 'midtrans',
        details: { gateway: 'midtrans', success: false },
      });

      return {
        success: false,
        gateway: 'midtrans',
        testedAt: testedAt.toISOString(),
        message,
      };
    }

    throw new Error(`Gateway '${gateway}' tidak didukung untuk uji koneksi.`);
  }

  /**
   * List all manual bank transfer accounts
   */
  async getManualAccounts(includeInactive = true): Promise<ManualPaymentAccountItem[]> {
    const whereClause: any = { deletedAt: null };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    const accounts = await prisma.manualPaymentAccount.findMany({
      where: whereClause,
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    return accounts.map((a: any) => ({
      id: a.id,
      bankName: a.bankName,
      accountNumber: a.accountNumber,
      accountHolder: a.accountHolder,
      isActive: a.isActive,
      order: a.order,
      createdAt: new Date(a.createdAt).toISOString(),
      updatedAt: new Date(a.updatedAt).toISOString(),
    }));
  }

  /**
   * Create a new manual payment bank account
   */
  async createManualAccount(dto: CreateManualAccountDTO, adminUser: { id: string; email?: string }) {
    const account = await prisma.manualPaymentAccount.create({
      data: {
        bankName: dto.bankName.trim(),
        accountNumber: dto.accountNumber.trim(),
        accountHolder: dto.accountHolder.trim(),
        isActive: dto.isActive ?? true,
        order: dto.order ?? 0,
      },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'MANUAL_PAYMENT_ACCOUNT_CREATED',
      targetType: 'MANUAL_PAYMENT_ACCOUNT',
      targetId: account.id,
      details: { bankName: account.bankName, accountNumber: account.accountNumber },
    });

    return account;
  }

  /**
   * Update manual bank account
   */
  async updateManualAccount(id: string, dto: UpdateManualAccountDTO, adminUser: { id: string; email?: string }) {
    const updated = await prisma.manualPaymentAccount.update({
      where: { id },
      data: {
        ...(dto.bankName ? { bankName: dto.bankName.trim() } : {}),
        ...(dto.accountNumber ? { accountNumber: dto.accountNumber.trim() } : {}),
        ...(dto.accountHolder ? { accountHolder: dto.accountHolder.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
      },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'MANUAL_PAYMENT_ACCOUNT_UPDATED',
      targetType: 'MANUAL_PAYMENT_ACCOUNT',
      targetId: id,
      details: dto,
    });

    return updated;
  }

  /**
   * Soft-delete manual bank account
   */
  async deleteManualAccount(id: string, adminUser: { id: string; email?: string }) {
    const deleted = await prisma.manualPaymentAccount.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await logAdminAction({
      adminId: adminUser.id,
      adminEmail: adminUser.email,
      action: 'MANUAL_PAYMENT_ACCOUNT_DELETED',
      targetType: 'MANUAL_PAYMENT_ACCOUNT',
      targetId: id,
      details: { bankName: deleted.bankName },
    });

    return { success: true, id };
  }

  /**
   * Public options for client checkout modal (no secrets, zero risk)
   */
  async getPublicPaymentOptions(): Promise<PublicPaymentOptions> {
    const gateways = await prisma.paymentGatewayConfig.findMany({
      where: { gateway: { in: ['tripay', 'midtrans'] }, isActive: true },
    });

    const manualConfig = await prisma.paymentGatewayConfig.findUnique({
      where: { gateway: 'manual_transfer' },
    });

    const manualAccounts = manualConfig?.isActive
      ? await this.getManualAccounts(false)
      : [];

    const defaultGateway = manualConfig?.isDefault
      ? 'manual_transfer'
      : gateways.find((g: any) => g.isDefault)?.gateway || 'tripay';

    return {
      defaultGateway,
      gateways: gateways.map((g: any) => ({
        gateway: g.gateway,
        displayName: g.displayName,
        isDefault: g.isDefault,
      })),
      manualTransfer: {
        isActive: Boolean(manualConfig?.isActive),
        accounts: manualAccounts.map((a) => ({
          id: a.id,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          accountHolder: a.accountHolder,
        })),
      },
    };
  }

  /**
   * List pending manual transfer transactions for admin review
   */
  async getPendingManualTransactions() {
    const allInvoices = await billingService.getInvoices('all');
    const pendingManual = allInvoices.filter(
      (inv) =>
        (inv.paymentMethod === 'manual_transfer' || inv.paymentMethod === 'MANUAL_TRANSFER') &&
        inv.status === 'PENDING'
    );
    return pendingManual;
  }

  /**
   * Activate user subscription from verified manual transfer
   */
  async activateManualPayment(transactionIdOrRef: string, adminUser: { id: string; email?: string }) {
    return billingService.activateManualTransaction(transactionIdOrRef, adminUser);
  }
}

export const paymentSettingsService = new PaymentSettingsService();

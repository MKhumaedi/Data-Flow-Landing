import { Request, Response, NextFunction } from 'express';
import { paymentSettingsService } from './payment-settings.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';

export class PaymentSettingsController {
  async getSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gateways = await paymentSettingsService.getGatewaysConfig();
      const manualConfig = await paymentSettingsService.getManualTransferConfig();
      const manualAccounts = await paymentSettingsService.getManualAccounts(true);
      const pendingManualTransactions = await paymentSettingsService.getPendingManualTransactions();

      res.json({
        success: true,
        data: {
          gateways,
          manualTransfer: {
            ...manualConfig,
            accounts: manualAccounts,
          },
          pendingManualTransactions,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateGateway(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gateway = req.params.gateway;
      const { isActive, isDefault } = req.body;
      const adminUser = {
        id: req.user?.userId || 'system-admin',
        email: req.user?.email || 'admin@maystudio.app',
      };

      const result = await paymentSettingsService.updateGatewayConfig(
        gateway,
        { isActive: Boolean(isActive), isDefault: Boolean(isDefault) },
        adminUser
      );

      res.json({
        success: true,
        data: result,
        message: `Konfigurasi gateway ${gateway} berhasil diperbarui.`,
      });
    } catch (err) {
      next(err);
    }
  }

  async testConnection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const gateway = req.params.gateway;
      const adminUser = {
        id: req.user?.userId || 'system-admin',
        email: req.user?.email || 'admin@maystudio.app',
      };

      const result = await paymentSettingsService.testGatewayConnection(gateway, adminUser);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listManualAccounts(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await paymentSettingsService.getManualAccounts(true);
      res.json({
        success: true,
        data: { accounts },
      });
    } catch (err) {
      next(err);
    }
  }

  async createManualAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { bankName, accountNumber, accountHolder, isActive, order } = req.body;
      if (!bankName || !accountNumber || !accountHolder) {
        res.status(400).json({
          success: false,
          message: 'Nama bank, nomor rekening, dan nama pemilik rekening wajib diisi.',
        });
        return;
      }

      const adminUser = {
        id: req.user?.userId || 'system-admin',
        email: req.user?.email || 'admin@maystudio.app',
      };

      const account = await paymentSettingsService.createManualAccount(
        { bankName, accountNumber, accountHolder, isActive, order },
        adminUser
      );

      res.status(201).json({
        success: true,
        data: account,
        message: 'Rekening transfer manual berhasil ditambahkan.',
      });
    } catch (err) {
      next(err);
    }
  }

  async updateManualAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUser = {
        id: req.user?.userId || 'system-admin',
        email: req.user?.email || 'admin@maystudio.app',
      };

      const account = await paymentSettingsService.updateManualAccount(id, req.body, adminUser);
      res.json({
        success: true,
        data: account,
        message: 'Rekening transfer manual berhasil diperbarui.',
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteManualAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUser = {
        id: req.user?.userId || 'system-admin',
        email: req.user?.email || 'admin@maystudio.app',
      };

      await paymentSettingsService.deleteManualAccount(id, adminUser);
      res.json({
        success: true,
        message: 'Rekening transfer manual berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }

  async getPublicOptions(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options = await paymentSettingsService.getPublicPaymentOptions();
      res.json({
        success: true,
        data: options,
      });
    } catch (err) {
      next(err);
    }
  }

  async activateManualPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminUser = {
        id: req.user?.userId || 'system-admin',
        email: req.user?.email || 'admin@maystudio.app',
      };

      const result = await paymentSettingsService.activateManualPayment(id, adminUser);
      res.json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const paymentSettingsController = new PaymentSettingsController();

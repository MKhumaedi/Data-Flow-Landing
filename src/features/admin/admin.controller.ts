import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { overviewService } from './overview/overview.service';
import { userAdminService } from './users/user-admin.service';
import { transactionsService } from './transactions/transactions.service';
import { contentService } from './content/content.service';
import { templateAdminService } from './templates/template-admin.service';
import { auditService } from './audit-log/audit.service';
import { systemHealthService } from './system-health/system-health.service';

export class AdminController {
  private getAdminInfo(req: AuthenticatedRequest) {
    return {
      id: req.user?.userId || req.user?.id || 'admin',
      email: req.user?.email || 'superadmin@maystudio.app',
    };
  }

  // MODULE 1 — Overview
  async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await overviewService.getStats();
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  // MODULE 2 — User Management
  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = (req.query.search || req.query.q) as string | undefined;
      const rawRole = (req.query.role || req.query.userRole) as string | undefined;
      const rawVerification = (req.query.verificationStatus || req.query.verification) as string | undefined;
      const rawStatus = (req.query.statusFilter || req.query.status) as string | undefined;
      const showDeleted = req.query.showDeleted === 'true';

      const role = rawRole ? rawRole.toUpperCase() : undefined;
      const verificationStatus = rawVerification ? rawVerification.toUpperCase() : undefined;
      let statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED' | undefined = undefined;
      if (rawStatus) {
        const upper = rawStatus.toUpperCase();
        if (upper === 'ACTIVE' || upper === 'SUSPENDED' || upper === 'ALL') {
          statusFilter = upper as any;
        }
      }

      const result = await userAdminService.listUsers({
        page,
        limit,
        search,
        role,
        verificationStatus,
        statusFilter,
        showDeleted,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async getUserDetail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.params.userId || req.params.id;
      const result = await userAdminService.getUserDetail(targetUserId);
      res.json({ success: true, data: { user: result } });
    } catch (err) {
      next(err);
    }
  }

  async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const { name, email, password, role, verificationStatus } = req.body;
      const user = await userAdminService.createUser(admin, {
        name,
        email,
        password,
        role,
        verificationStatus,
      });
      res.status(201).json({
        success: true,
        data: { user },
        message: 'Pengguna baru berhasil ditambahkan.',
      });
    } catch (err) {
      next(err);
    }
  }

  async updateUserProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId || req.params.id;
      const { name, email } = req.body;

      const user = await userAdminService.editUserProfile(admin, targetUserId, { name, email });
      res.json({
        success: true,
        data: { user },
        message: 'Profil pengguna berhasil diperbarui.',
      });
    } catch (err) {
      next(err);
    }
  }

  async resetUserPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId || req.params.id;
      const { password } = req.body;

      const result = await userAdminService.resetUserPassword(admin, targetUserId, password);
      res.json({
        success: true,
        data: result,
        message: 'Kata sandi pengguna berhasil direset.',
      });
    } catch (err) {
      next(err);
    }
  }

  async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const { role } = req.body;

      if (!['FREE', 'PREMIUM', 'SUPERADMIN'].includes(role)) {
        res.status(400).json({ success: false, message: 'Invalid role specified' });
        return;
      }

      const result = await userAdminService.updateUserRole(admin, targetUserId, role);
      res.json({ success: true, data: result, message: `Role pengguna berhasil diubah ke ${role}` });
    } catch (err) {
      next(err);
    }
  }

  async suspendUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const result = await userAdminService.updateUserStatus(admin, targetUserId, true);
      res.json({
        success: true,
        data: result,
        message: 'Akun pengguna berhasil disuspend',
      });
    } catch (err) {
      next(err);
    }
  }

  async reactivateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const result = await userAdminService.updateUserStatus(admin, targetUserId, false);
      res.json({
        success: true,
        data: result,
        message: 'Akun pengguna berhasil diaktifkan kembali',
      });
    } catch (err) {
      next(err);
    }
  }

  async verifyUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const status = (req.body?.status || 'VERIFIED').toUpperCase();
      const result = await userAdminService.updateUserVerification(admin, targetUserId, status as any);
      res.json({
        success: true,
        data: result,
        message: `Status verifikasi pengguna berhasil diperbarui menjadi ${status}`,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const { isSuspended } = req.body;

      const result = await userAdminService.updateUserStatus(admin, targetUserId, !!isSuspended);
      res.json({
        success: true,
        data: result,
        message: isSuspended ? 'Akun pengguna berhasil disuspend' : 'Akun pengguna berhasil diaktifkan kembali',
      });
    } catch (err) {
      next(err);
    }
  }

  async updateUserVerification(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const { status } = req.body;

      if (!['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) {
        res.status(400).json({ success: false, message: 'Status verifikasi tidak valid' });
        return;
      }

      const result = await userAdminService.updateUserVerification(admin, targetUserId, status);
      res.json({
        success: true,
        data: result,
        message: `Status verifikasi pengguna berhasil diperbarui menjadi ${status}`,
      });
    } catch (err) {
      next(err);
    }
  }

  async softDeleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const result = await userAdminService.softDeleteUser(admin, targetUserId);
      res.json({ success: true, data: result, message: 'Pengguna berhasil dihapus secara soft-delete' });
    } catch (err) {
      next(err);
    }
  }

  async restoreUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const targetUserId = req.params.userId;
      const result = await userAdminService.restoreUser(admin, targetUserId);
      res.json({ success: true, data: result, message: 'Akun pengguna berhasil dipulihkan' });
    } catch (err) {
      next(err);
    }
  }

  // MODULE 3 — Transactions
  async listTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      const transactions = await transactionsService.listTransactions({ status, startDate, endDate, search });
      res.json({ success: true, data: { transactions } });
    } catch (err) {
      next(err);
    }
  }

  async exportTransactionsCsv(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const search = req.query.search as string | undefined;

      const csv = await transactionsService.exportCsv({ status, startDate, endDate, search });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=tripay-transactions-${Date.now()}.csv`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  }

  async approveTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const { id } = req.params;
      const result = await transactionsService.approveTransaction(id, admin);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async rejectTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const { id } = req.params;
      const { reason } = req.body;
      const result = await transactionsService.rejectTransaction(id, reason, admin);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // MODULE 4 — Content Management
  async listContent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await contentService.getAll();
      res.json({ success: true, data: { items } });
    } catch (err) {
      next(err);
    }
  }

  async updateContentBatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, message: 'Items array is required' });
        return;
      }

      const updated = await contentService.updateBatch(admin, items);
      res.json({ success: true, data: { items: updated }, message: 'Konten berhasil diperbarui' });
    } catch (err) {
      next(err);
    }
  }

  // MODULE 5 — Template Builder
  async listTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const includeArchived = req.query.includeArchived === 'true';
      const templates = await templateAdminService.listTemplates(includeArchived);
      res.json({ success: true, data: { templates } });
    } catch (err) {
      next(err);
    }
  }

  async createTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const { name, description, thumbnail, isPremium, layoutConfig } = req.body;

      if (!name || !layoutConfig) {
        res.status(400).json({ success: false, message: 'Nama dan layoutConfig template wajib diisi' });
        return;
      }

      const template = await templateAdminService.createTemplate(admin, {
        name,
        description,
        thumbnail,
        isPremium,
        layoutConfig,
      });

      res.status(201).json({ success: true, data: { template }, message: 'Template berhasil dibuat' });
    } catch (err) {
      next(err);
    }
  }

  async updateTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const templateId = req.params.templateId;
      const { name, description, thumbnail, isPremium, layoutConfig } = req.body;

      const updated = await templateAdminService.updateTemplate(admin, templateId, {
        name,
        description,
        thumbnail,
        isPremium,
        layoutConfig,
      });

      if (!updated) {
        res.status(404).json({ success: false, message: 'Template tidak ditemukan' });
        return;
      }

      res.json({ success: true, data: { template: updated }, message: 'Template berhasil diperbarui' });
    } catch (err) {
      next(err);
    }
  }

  async toggleTemplatePremium(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const templateId = req.params.templateId;
      const { isPremium } = req.body;

      const updated = await templateAdminService.togglePremium(admin, templateId, !!isPremium);
      res.json({ success: true, data: { template: updated } });
    } catch (err) {
      next(err);
    }
  }

  async archiveTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const templateId = req.params.templateId;

      const result = await templateAdminService.archiveTemplate(admin, templateId);
      res.json({ success: true, data: result, message: 'Template berhasil diarsipkan' });
    } catch (err) {
      next(err);
    }
  }

  async restoreTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = this.getAdminInfo(req);
      const templateId = req.params.templateId;

      const result = await templateAdminService.restoreTemplate(admin, templateId);
      res.json({ success: true, data: result, message: 'Template berhasil dipulihkan' });
    } catch (err) {
      next(err);
    }
  }

  // MODULE 6 — Audit Log (Read-only)
  async listAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const admin = req.query.admin as string | undefined;
      const action = req.query.action as string | undefined;
      const targetType = req.query.targetType as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const result = await auditService.listLogs({
        page,
        limit,
        admin,
        action,
        targetType,
        startDate,
        endDate,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // MODULE 7 — System Health
  async getSystemHealth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const health = await systemHealthService.getHealth();
      res.json({ success: true, data: health });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();

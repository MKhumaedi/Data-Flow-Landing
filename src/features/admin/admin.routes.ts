import { Router } from 'express';
import multer from 'multer';
import { adminController } from './admin.controller';
import { formulaController } from '../formulas/formula.controller';
import { formController } from '../forms/form.controller';
import { blogController } from '../blog/blog.controller';
import { adSlotController } from '../ad-slots/ad-slot.controller';
import { adInventoryController } from '../ads/ad.controller';
import { siteSettingsController } from '../site-settings/site-settings.controller';
import { planController } from '../plans/plan.controller';
import { trialModeController } from '../plans/trial-mode.controller';
import { adminPaymentSettingsRoutes } from '../payment-settings/payment-settings.routes';
import { adminNotificationRoutes } from '../notifications/notification.routes';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole.middleware';

const router = Router();

// ==========================================
// STRICT SUPERADMIN ACCESS CONTROL
// Every admin endpoint requires JWT + SUPERADMIN role
// ==========================================
router.use(requireAuth);
router.use(requireRole(['SUPERADMIN']));

// MODULE 1 — Overview
router.get('/stats', (req, res, next) => adminController.getStats(req, res, next));

// MODULE 2 — User Management
router.get('/users', (req, res, next) => adminController.listUsers(req, res, next));
router.post('/users', (req, res, next) => adminController.createUser(req, res, next));
router.get('/users/:userId', (req, res, next) => adminController.getUserDetail(req, res, next));
router.patch('/users/:userId', (req, res, next) => adminController.updateUserProfile(req, res, next));
router.patch('/users/:userId/profile', (req, res, next) => adminController.updateUserProfile(req, res, next));
router.post('/users/:userId/reset-password', (req, res, next) => adminController.resetUserPassword(req, res, next));
router.patch('/users/:userId/role', (req, res, next) => adminController.updateUserRole(req, res, next));
router.patch('/users/:userId/status', (req, res, next) => adminController.updateUserStatus(req, res, next));
router.patch('/users/:userId/suspend', (req, res, next) => adminController.suspendUser(req, res, next));
router.patch('/users/:userId/reactivate', (req, res, next) => adminController.reactivateUser(req, res, next));
router.patch('/users/:userId/verify', (req, res, next) => adminController.verifyUser(req, res, next));
router.patch('/users/:userId/verification', (req, res, next) => adminController.updateUserVerification(req, res, next));
router.delete('/users/:userId', (req, res, next) => adminController.softDeleteUser(req, res, next));
router.patch('/users/:userId/restore', (req, res, next) => adminController.restoreUser(req, res, next));

// MODULE 3 — Transactions
router.get('/transactions', (req, res, next) => adminController.listTransactions(req, res, next));
router.get('/transactions/export', (req, res, next) => adminController.exportTransactionsCsv(req, res, next));
router.post('/transactions/:id/approve', (req, res, next) => adminController.approveTransaction(req, res, next));
router.post('/transactions/:id/reject', (req, res, next) => adminController.rejectTransaction(req, res, next));

// MODULE 4 — Content Management (CMS)
router.get('/content', (req, res, next) => adminController.listContent(req, res, next));
router.put('/content/batch', (req, res, next) => adminController.updateContentBatch(req, res, next));

// MODULE 5 — Dashboard Themes & Templates
router.get('/templates', (req, res, next) => adminController.listTemplates(req, res, next));
router.post('/templates', (req, res, next) => adminController.createTemplate(req, res, next));
router.put('/templates/:templateId', (req, res, next) => adminController.updateTemplate(req, res, next));
router.patch('/templates/:templateId/premium', (req, res, next) => adminController.toggleTemplatePremium(req, res, next));
router.delete('/templates/:templateId', (req, res, next) => adminController.archiveTemplate(req, res, next));
router.patch('/templates/:templateId/restore', (req, res, next) => adminController.restoreTemplate(req, res, next));

// MODULE 6 — Formula Management (/admin/formulas)
router.get('/formulas', (req, res, next) => formulaController.listAdmin(req, res, next));
router.post('/formulas/bulk-import', (req, res, next) => formulaController.bulkImport(req, res, next));
router.post('/formulas', (req, res, next) => formulaController.create(req, res, next));
router.put('/formulas/:id', (req, res, next) => formulaController.update(req, res, next));
router.delete('/formulas/:id', (req, res, next) => formulaController.softDelete(req, res, next));
router.patch('/formulas/:id/restore', (req, res, next) => formulaController.restore(req, res, next));

// MODULE 6B — Form Template Management (/admin/forms)
router.get('/forms', (req, res, next) => formController.listAdmin(req, res, next));
router.post('/forms/bulk-import', (req, res, next) => formController.bulkImport(req, res, next));
router.post('/forms', (req, res, next) => formController.create(req, res, next));
router.put('/forms/:id', (req, res, next) => formController.update(req, res, next));
router.delete('/forms/:id', (req, res, next) => formController.softDelete(req, res, next));
router.patch('/forms/:id/restore', (req, res, next) => formController.restore(req, res, next));

// MODULE 6C — Blog Management (/admin/blog)
const uploadBlogImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
router.get('/blog', (req, res, next) => blogController.listAdmin(req, res, next));
router.get('/blog/:id', (req, res, next) => blogController.getAdminById(req, res, next));
router.post('/blog', (req, res, next) => blogController.create(req, res, next));
router.put('/blog/:id', (req, res, next) => blogController.update(req, res, next));
router.patch('/blog/:id/status', (req, res, next) => blogController.toggleStatus(req, res, next));
router.delete('/blog/:id', (req, res, next) => blogController.softDelete(req, res, next));
router.patch('/blog/:id/restore', (req, res, next) => blogController.restore(req, res, next));
router.post('/blog/upload-image', uploadBlogImage.single('image') as any, (req: any, res: any, next: any) => blogController.uploadInlineImage(req, res, next));
router.post('/blog/pexels/search', (req, res, next) => blogController.searchPexels(req, res, next));
router.post('/blog/pexels/select', (req, res, next) => blogController.selectPexelsPhoto(req, res, next));
router.post('/blog/pexels/placeholder', (req, res, next) => blogController.generatePlaceholder(req, res, next));


// MODULE 7 — Ad Inventory Management (/admin/ads)
const uploadAd = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});
router.get('/ads/placements', (req, res, next) => adInventoryController.listPlacements(req, res, next));
router.post('/ads/placements', (req, res, next) => adInventoryController.createPlacement(req, res, next));
router.put('/ads/placements/:id', (req, res, next) => adInventoryController.updatePlacement(req, res, next));
router.get('/ads/bookings', (req, res, next) => adInventoryController.listBookings(req, res, next));
router.post('/ads/bookings', (req, res, next) => adInventoryController.createBooking(req, res, next));
router.post('/ads/bookings/upload-image', uploadAd.single('image') as any, (req: any, res: any, next: any) => adInventoryController.uploadBookingImage(req, res, next));
router.post('/ads/bookings/:id/cancel', (req, res, next) => adInventoryController.cancelBooking(req, res, next));
router.get('/ads/inquiries', (req, res, next) => adInventoryController.listInquiries(req, res, next));
router.patch('/ads/inquiries/:id/status', (req, res, next) => adInventoryController.updateInquiryStatus(req, res, next));
router.put('/ads/inquiries/:id/status', (req, res, next) => adInventoryController.updateInquiryStatus(req, res, next));

// Legacy / Compatible Ad Slot Management
router.get('/ad-slots', (req, res, next) => adSlotController.listAdmin(req, res, next));
router.post('/ad-slots', (req, res, next) => adSlotController.create(req, res, next));
router.put('/ad-slots/:id', (req, res, next) => adSlotController.update(req, res, next));
router.delete('/ad-slots/:id', (req, res, next) => adSlotController.softDelete(req, res, next));
router.patch('/ad-slots/:id/restore', (req, res, next) => adSlotController.restore(req, res, next));

// MODULE 8 — Immutable Audit Log (Read-only)
router.get('/audit-logs', (req, res, next) => adminController.listAuditLogs(req, res, next));

// MODULE 9 — System Health
router.get('/system/health', (req, res, next) => adminController.getSystemHealth(req, res, next));

// MODULE 10 — Site Integrations & Analytics (GTM, GA4, GSC)
router.get('/integrations', (req, res, next) => siteSettingsController.getAdminIntegrations(req, res, next));
router.put('/integrations', (req, res, next) => siteSettingsController.updateAdminIntegrations(req, res, next));
router.post('/integrations', (req, res, next) => siteSettingsController.updateAdminIntegrations(req, res, next));

// MODULE 11 — Subscription Plans & Dynamic Pricing (/admin/plans)
router.get('/plans', (req, res, next) => planController.listAll(req, res, next));
router.get('/plans/:id', (req, res, next) => planController.getById(req, res, next));
router.post('/plans', (req, res, next) => planController.create(req, res, next));
router.put('/plans/:id', (req, res, next) => planController.update(req, res, next));
router.delete('/plans/:id', (req, res, next) => planController.archive(req, res, next));
router.post('/plans/:id/restore', (req, res, next) => planController.restore(req, res, next));
router.post('/plans/:id/pricing', (req, res, next) => planController.createPricing(req, res, next));
router.put('/plans/pricing/:pricingId', (req, res, next) => planController.updatePricing(req, res, next));
router.delete('/plans/pricing/:pricingId', (req, res, next) => planController.deletePricing(req, res, next));

// MODULE 12 — Global Free Trial Mode (/admin/trial-mode)
router.get('/trial-mode', (req, res, next) => trialModeController.getStatus(req, res, next));
router.post('/trial-mode/activate', (req, res, next) => trialModeController.activate(req as any, res, next));
router.post('/trial-mode/deactivate', (req, res, next) => trialModeController.deactivate(req as any, res, next));

// MODULE 13 — Payment System Management (/admin/payment-settings)
router.use('/payment-settings', adminPaymentSettingsRoutes);

// MODULE 14 — Notifications & Broadcasts (/admin/notifications)
router.use('/notifications', adminNotificationRoutes);

export const adminRoutes = router;

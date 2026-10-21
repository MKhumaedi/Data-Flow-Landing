import { Router } from 'express';
import { authRoutes } from '../features/auth/auth.routes';
import { datasetRoutes } from '../features/dataset/dataset.routes';
import { dashboardRoutes } from '../features/dashboard/dashboard.routes';
import { templateRoutes } from '../features/template/template.routes';
import { billingRoutes } from '../features/billing/billing.routes';
import { blogPublicRoutes } from '../features/blog/blog.routes';
import { adminRoutes } from '../features/admin/admin.routes';
import { publicContentRoutes } from '../features/content/content.routes';
import { formulaPublicRoutes } from '../features/formulas/formula.routes';
import { formPublicRoutes } from '../features/forms/form.routes';
import { adSlotPublicRoutes } from '../features/ad-slots/ad-slot.routes';
import { adPublicRoutes } from '../features/ads/ad.routes';
import { cvRoutes } from '../features/cv/cv.routes';
import { publicSiteSettingsRoutes } from '../features/site-settings/site-settings.routes';
import { searchRoutes } from '../features/search/search.routes';
import { planPublicRoutes } from '../features/plans/plan.routes';
import { publicPaymentSettingsRoutes } from '../features/payment-settings/payment-settings.routes';
import { notificationRoutes } from '../features/notifications/notification.routes';
import { trialModeController } from '../features/plans/trial-mode.controller';
import { billingController } from '../features/billing/billing.controller';
import { userTransactionsController } from '../features/billing/user-transactions.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', authRoutes);
router.use('/datasets', datasetRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/templates', templateRoutes);
router.use('/billing', billingRoutes);
router.use('/payment-settings', publicPaymentSettingsRoutes);
router.use('/blog', blogPublicRoutes);
router.use('/content', publicContentRoutes);
router.use('/formulas', formulaPublicRoutes);
router.use('/forms', formPublicRoutes);
router.use('/ad-slots', adSlotPublicRoutes);
router.use('/ads', adPublicRoutes);
router.use('/cv', cvRoutes);
router.use('/site-settings', publicSiteSettingsRoutes);
router.use('/search', searchRoutes);
router.use('/plans', planPublicRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

// Public Global Free Trial Mode status endpoint
router.get('/trial-mode', (req, res, next) => trialModeController.getStatus(req, res, next));

// Public Ad Inquiry direct endpoints
router.post('/ad-inquiries', (req, res, next) => adPublicRoutes(req, res, next));
router.get('/ad-inquiries/public-info', (req, res, next) => adPublicRoutes(req, res, next));

// Authenticated user transaction history
router.get('/users/me/transactions', requireAuth, (req, res, next) => {
  userTransactionsController.getMyTransactions(req, res, next);
});

// Direct top-level webhook route within /api
router.post('/secret/payment/tripay', (req, res, next) => {
  billingController.handleWebhook(req, res, next);
});
router.get('/secret/payment/tripay', (req, res) => {
  billingController.getWebhookInfo(req, res);
});

router.get('/analytics/summary', (req, res) => {
  res.json({
    success: true,
    data: {
      totalDashboardsGenerated: 12450,
      totalRowsProcessed: 8450000,
      averageTimeSeconds: 4.2,
      activeUsersCount: 3820,
    },
  });
});

export default router;
export const apiRoutes = router;

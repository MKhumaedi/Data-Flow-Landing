import { Router } from 'express';
import { billingController } from './billing.controller';
import { userTransactionsController } from './user-transactions.controller';
import { upgradePlanSchema } from './billing.validation';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// Payment channels (public / accessible for checkout)
router.get('/payment-channels', (req, res, next) => {
  billingController.getChannels(req, res, next);
});
router.get('/channels', (req, res, next) => {
  billingController.getChannels(req, res, next);
});

// Authenticated billing routes
router.post(
  '/upgrade',
  requireAuth,
  validateRequest({ body: upgradePlanSchema }),
  billingController.upgrade
);

router.post(
  '/manual-checkout',
  requireAuth,
  (req, res, next) => billingController.manualCheckout(req, res, next)
);

router.get(
  '/invoices',
  requireAuth,
  billingController.listInvoices
);

router.get(
  '/transactions',
  requireAuth,
  (req, res, next) => userTransactionsController.getMyTransactions(req, res, next)
);

router.get(
  '/transaction-status/:merchantRef',
  requireAuth,
  (req, res, next) => billingController.checkStatus(req, res, next)
);

router.post(
  '/simulate-payment/:merchantRef',
  requireAuth,
  (req, res, next) => billingController.simulatePayment(req, res, next)
);

// Public Tripay Webhook endpoints (Protected by HMAC-SHA256 signature verification)
router.post('/secret/payment/tripay', (req, res, next) => {
  billingController.handleWebhook(req, res, next);
});
router.get('/secret/payment/tripay', (req, res) => {
  billingController.getWebhookInfo(req, res);
});

router.post('/webhook', (req, res, next) => {
  billingController.handleWebhook(req, res, next);
});
router.get('/webhook', (req, res) => {
  billingController.getWebhookInfo(req, res);
});

export const billingRoutes = router;

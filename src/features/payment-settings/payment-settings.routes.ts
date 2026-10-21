import { Router } from 'express';
import { paymentSettingsController } from './payment-settings.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole.middleware';

// Public routes (for checkout modal)
export const publicPaymentSettingsRoutes = Router();
publicPaymentSettingsRoutes.get('/options', (req, res, next) => {
  paymentSettingsController.getPublicOptions(req, res, next);
});

// Admin routes (SUPERADMIN strictly required)
export const adminPaymentSettingsRoutes = Router();
adminPaymentSettingsRoutes.use(requireAuth);
adminPaymentSettingsRoutes.use(requireRole(['SUPERADMIN']));

adminPaymentSettingsRoutes.get('/', (req, res, next) => {
  paymentSettingsController.getSettings(req, res, next);
});

adminPaymentSettingsRoutes.put('/gateways/:gateway', (req, res, next) => {
  paymentSettingsController.updateGateway(req, res, next);
});

adminPaymentSettingsRoutes.post('/test-connection/:gateway', (req, res, next) => {
  paymentSettingsController.testConnection(req, res, next);
});

adminPaymentSettingsRoutes.get('/manual-accounts', (req, res, next) => {
  paymentSettingsController.listManualAccounts(req, res, next);
});

adminPaymentSettingsRoutes.post('/manual-accounts', (req, res, next) => {
  paymentSettingsController.createManualAccount(req, res, next);
});

adminPaymentSettingsRoutes.put('/manual-accounts/:id', (req, res, next) => {
  paymentSettingsController.updateManualAccount(req, res, next);
});

adminPaymentSettingsRoutes.delete('/manual-accounts/:id', (req, res, next) => {
  paymentSettingsController.deleteManualAccount(req, res, next);
});

adminPaymentSettingsRoutes.post('/transactions/:id/activate', (req, res, next) => {
  paymentSettingsController.activateManualPayment(req, res, next);
});

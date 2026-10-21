import { Router } from 'express';
import { planController } from './plan.controller';
import { trialModeController } from './trial-mode.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole.middleware';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { createPlanSchema, updatePlanSchema, createPricingSchema, updatePricingSchema } from './plan.validation';

// Public routes for visitors & users
export const planPublicRoutes = Router();
planPublicRoutes.get('/trial-mode', (req, res, next) => trialModeController.getStatus(req, res, next));
planPublicRoutes.get('/user/limits', requireAuth, (req, res, next) => planController.getUserLimits(req as any, res, next));
planPublicRoutes.get('/', (req, res, next) => planController.listActive(req, res, next));
planPublicRoutes.get('/:id', (req, res, next) => planController.getById(req, res, next));

// Admin routes for superadmin / admin
export const planAdminRoutes = Router();
planAdminRoutes.use(requireAuth);
planAdminRoutes.use(requireRole(['SUPERADMIN']));

planAdminRoutes.get('/', (req, res, next) => planController.listAll(req, res, next));
planAdminRoutes.get('/:id', (req, res, next) => planController.getById(req, res, next));
planAdminRoutes.post('/', validateRequest({ body: createPlanSchema }), (req, res, next) =>
  planController.create(req, res, next)
);
planAdminRoutes.put('/:id', validateRequest({ body: updatePlanSchema }), (req, res, next) =>
  planController.update(req, res, next)
);
planAdminRoutes.delete('/:id', (req, res, next) => planController.archive(req, res, next));
planAdminRoutes.post('/:id/restore', (req, res, next) => planController.restore(req, res, next));

planAdminRoutes.post(
  '/:id/pricing',
  validateRequest({ body: createPricingSchema }),
  (req, res, next) => planController.createPricing(req, res, next)
);
planAdminRoutes.put(
  '/pricing/:pricingId',
  validateRequest({ body: updatePricingSchema }),
  (req, res, next) => planController.updatePricing(req, res, next)
);
planAdminRoutes.delete('/pricing/:pricingId', (req, res, next) =>
  planController.deletePricing(req, res, next)
);

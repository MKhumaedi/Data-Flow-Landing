import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { createDashboardSchema, updateDashboardSchema } from './dashboard.validation';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { requireAuth, optionalAuth } from '../../middleware/auth.middleware';

const router = Router();

// Public share link route
router.get('/public/:publicId', dashboardController.getPublic);

// Excel Export routes (supports verified authenticated users and public demo preview)
router.get('/:id/export/excel', optionalAuth, dashboardController.exportExcel);
router.post('/:id/export/excel', optionalAuth, dashboardController.exportExcel);

// Authenticated routes
router.get('/', requireAuth, dashboardController.list);
router.get('/trash', requireAuth, dashboardController.listTrash);
router.get('/:id', requireAuth, dashboardController.getById);
router.post('/', requireAuth, validateRequest({ body: createDashboardSchema }), dashboardController.create);
router.post('/:id/duplicate', requireAuth, dashboardController.duplicate);
router.post('/:id/restore', requireAuth, dashboardController.restore);
router.put('/:id', requireAuth, validateRequest({ body: updateDashboardSchema }), dashboardController.update);
router.delete('/:id/permanent', requireAuth, dashboardController.permanentDelete);
router.delete('/:id', requireAuth, dashboardController.delete);

export const dashboardRoutes = router;

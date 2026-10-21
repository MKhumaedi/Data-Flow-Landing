import { Router } from 'express';
import multer from 'multer';
import { adInventoryController } from './ad.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/requireRole.middleware';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const publicRouter = Router();
publicRouter.get('/public-info', (req, res, next) => adInventoryController.getPublicAdInfo(req, res, next));
publicRouter.get('/active/:placementKey', (req, res, next) => adInventoryController.getActiveAd(req, res, next));
publicRouter.get('/images/:placementKey/:filename', (req, res, next) => adInventoryController.serveAdImage(req, res, next));
publicRouter.post('/inquiries', (req, res, next) => adInventoryController.createInquiry(req, res, next));

const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(requireRole(['SUPERADMIN']));

adminRouter.get('/placements', (req, res, next) => adInventoryController.listPlacements(req, res, next));
adminRouter.post('/placements', (req, res, next) => adInventoryController.createPlacement(req, res, next));
adminRouter.put('/placements/:id', (req, res, next) => adInventoryController.updatePlacement(req, res, next));
adminRouter.post('/placements/:id/preview-image', upload.single('previewImage') as any, (req: any, res: any, next: any) => adInventoryController.uploadPlacementPreview(req, res, next));

adminRouter.get('/bookings', (req, res, next) => adInventoryController.listBookings(req, res, next));
adminRouter.post('/bookings', (req, res, next) => adInventoryController.createBooking(req, res, next));
adminRouter.post('/bookings/upload-image', upload.single('image') as any, (req: any, res: any, next: any) => adInventoryController.uploadBookingImage(req, res, next));
adminRouter.post('/bookings/:id/cancel', (req, res, next) => adInventoryController.cancelBooking(req, res, next));

adminRouter.get('/inquiries', (req, res, next) => adInventoryController.listInquiries(req, res, next));
adminRouter.patch('/inquiries/:id/status', (req, res, next) => adInventoryController.updateInquiryStatus(req, res, next));
adminRouter.put('/inquiries/:id/status', (req, res, next) => adInventoryController.updateInquiryStatus(req, res, next));

export const adPublicRoutes = publicRouter;
export const adAdminRoutes = adminRouter;


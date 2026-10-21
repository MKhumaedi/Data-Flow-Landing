import { Router } from 'express';
import { datasetController } from './dataset.controller';
import { createDatasetSchema } from './dataset.validation';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, datasetController.list);
router.get('/:id', requireAuth, datasetController.getById);
router.post('/', requireAuth, validateRequest({ body: createDatasetSchema }), datasetController.create);
router.delete('/:id', requireAuth, datasetController.delete);

export const datasetRoutes = router;

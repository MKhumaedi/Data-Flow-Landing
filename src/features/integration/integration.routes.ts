import { Router } from 'express';
import { integrationController } from './integration.controller';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, integrationController.list);
router.post('/:id/toggle', requireAuth, integrationController.toggle);

export const integrationRoutes = router;

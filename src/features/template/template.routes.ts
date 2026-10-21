import { Router } from 'express';
import { templateController } from './template.controller';

const router = Router();

router.get('/', templateController.list);
router.get('/:id', templateController.getById);

export const templateRoutes = router;

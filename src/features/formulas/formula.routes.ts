import { Router } from 'express';
import { formulaController } from './formula.controller';

const router = Router();

// Public routes (No authentication required)
router.get('/', (req, res, next) => formulaController.listPublic(req, res, next));
router.get('/:slug', (req, res, next) => formulaController.getBySlug(req, res, next));

export const formulaPublicRoutes = router;

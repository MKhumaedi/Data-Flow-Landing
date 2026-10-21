import { Router } from 'express';
import { formController } from './form.controller';

const router = Router();

// Public routes for Business Forms (no auth required)
router.get('/', (req, res, next) => formController.listPublic(req, res, next));
router.get('/:slug', (req, res, next) => formController.getBySlug(req, res, next));

export const formPublicRoutes = router;

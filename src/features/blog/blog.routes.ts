import { Router } from 'express';
import { blogController } from './blog.controller';

const router = Router();

// Public blog image serving
router.get('/images/:filename', (req, res, next) => blogController.serveCoverImage(req, res, next));

// Pexels search & processing routes
router.post('/pexels/search', (req, res, next) => blogController.searchPexels(req, res, next));
router.post('/pexels/select', (req, res, next) => blogController.selectPexelsPhoto(req, res, next));
router.post('/pexels/placeholder', (req, res, next) => blogController.generatePlaceholder(req, res, next));

// Public blog endpoints
router.get('/categories', (req, res, next) => blogController.getCategories(req, res, next));
router.get('/:slug', (req, res, next) => blogController.getBySlug(req, res, next));
router.get('/', (req, res, next) => blogController.listPublic(req, res, next));

export const blogPublicRoutes = router;


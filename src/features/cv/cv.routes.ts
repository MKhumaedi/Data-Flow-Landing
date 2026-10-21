import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { cvController } from './cv.controller';

const router = Router();

// Quota check endpoint
router.get('/quota', requireAuth, (req, res, next) => {
  cvController.getQuota(req, res, next);
});

// Match analysis endpoint
router.post('/match-analysis', requireAuth, (req, res, next) => {
  cvController.analyzeMatch(req, res, next);
});

export const cvRoutes = router;

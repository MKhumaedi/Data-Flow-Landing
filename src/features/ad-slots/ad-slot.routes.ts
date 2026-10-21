import { Router } from 'express';
import { adSlotController } from './ad-slot.controller';

const router = Router();

// Public route to fetch active ad for a given placement (e.g. formula_page_sidebar_right)
router.get('/placement/:placement', (req, res, next) => adSlotController.getByPlacement(req, res, next));

export const adSlotPublicRoutes = router;

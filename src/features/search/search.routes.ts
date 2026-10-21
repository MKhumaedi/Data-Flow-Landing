import { Router } from 'express';
import { searchController } from './search.controller';

const router = Router();

router.get('/', (req, res, next) => {
  searchController.globalSearch(req, res, next);
});

export const searchRoutes = router;

import { Router } from 'express';
import { contentService } from '../admin/content/content.service';

const router = Router();

// Public endpoint to fetch all dynamic content values as a key-value dictionary
router.get('/', async (req, res, next) => {
  try {
    const dict = await contentService.getPublicDictionary();
    res.json({ success: true, data: dict });
  } catch (err) {
    next(err);
  }
});

// Public endpoint to fetch a single content value by key
router.get('/:key', async (req, res, next) => {
  try {
    const item = await contentService.getByKey(req.params.key);
    if (!item) {
      res.status(404).json({ success: false, message: 'Content key not found' });
      return;
    }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

export const publicContentRoutes = router;

import { Router } from 'express';
import multer from 'multer';
import { authController } from './auth.controller';
import {
  signupSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  deleteAccountSchema,
} from './auth.validation';
import { validateRequest } from '../../middleware/validateRequest.middleware';
import { rateLimiter } from '../../middleware/rateLimiter.middleware';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const isImage = file.mimetype.toLowerCase().startsWith('image/');
    if (isImage) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Hanya dapat mengunggah file gambar (JPG, JPEG, PNG, WEBP, atau format gambar lainnya).'));
    }
  },
});

const handleAvatarUpload = (req: any, res: any, next: any) => {
  uploadAvatar.single('avatar')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Ukuran foto profil melebihi batas maksimal 2MB. Silakan pilih foto dengan ukuran lebih kecil.',
          },
          message: 'Ukuran foto profil melebihi batas maksimal 2MB. Silakan pilih foto dengan ukuran lebih kecil.',
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: err.message || 'Hanya file gambar yang diizinkan untuk foto profil.',
        },
        message: err.message || 'Hanya file gambar yang diizinkan untuk foto profil.',
      });
      return;
    }
    next();
  });
};

// Rate limiter: Max 30 attempts per 15 minutes per IP for signup and login
const authRateLimiter = rateLimiter(15 * 60 * 1000, 30);

router.post(
  '/signup',
  authRateLimiter,
  validateRequest({ body: signupSchema }),
  authController.signup
);

// Backward compatibility alias for register
router.post(
  '/register',
  authRateLimiter,
  validateRequest({ body: signupSchema }),
  authController.signup
);

router.post(
  '/login',
  authRateLimiter,
  validateRequest({ body: loginSchema }),
  authController.login
);

router.post(
  '/refresh',
  rateLimiter(15 * 60 * 1000, 60),
  authController.refresh
);

router.post(
  '/logout',
  authController.logout
);

router.get(
  '/me',
  requireAuth,
  authController.getMe
);

router.put(
  '/profile',
  requireAuth,
  validateRequest({ body: updateProfileSchema }),
  authController.updateProfile
);

router.post(
  '/avatar',
  requireAuth,
  handleAvatarUpload as any,
  authController.uploadAvatar
);

router.delete(
  '/avatar',
  requireAuth,
  authController.deleteAvatar
);

router.get(
  '/avatar/:filename',
  authController.serveAvatar
);

router.post(
  '/change-password',
  requireAuth,
  validateRequest({ body: changePasswordSchema }),
  authController.changePassword
);

router.get(
  '/export-data',
  requireAuth,
  authController.exportUserData
);

router.delete(
  '/account',
  requireAuth,
  validateRequest({ body: deleteAccountSchema }),
  authController.deleteAccount
);

export const authRoutes = router;


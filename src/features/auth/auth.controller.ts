import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { authService } from './auth.service';
import { trialModeService } from '../plans/trial-mode.service';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { env } from '../../config/env';

const REFRESH_COOKIE_NAME = 'dataflow_rt';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, accessToken, refreshToken } = await authService.signup(req.body);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
      res.cookie('dataflow_at', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
      res.status(201).json({
        success: true,
        data: {
          user,
          tokens: {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    return this.signup(req, res, next);
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, accessToken, refreshToken } = await authService.login(req.body);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
      res.cookie('dataflow_at', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
      res.json({
        success: true,
        data: {
          user,
          tokens: {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      if (!rawRefreshToken) {
        res.status(401).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Cookie sesi refresh token tidak ditemukan.',
          },
        });
        return;
      }

      const { user, accessToken, refreshToken } = await authService.refreshAccessToken(rawRefreshToken);
      res.cookie(REFRESH_COOKIE_NAME, refreshToken, COOKIE_OPTIONS);
      res.cookie('dataflow_at', accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
      res.json({
        success: true,
        data: {
          user,
          tokens: {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: 900,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      await authService.logout(rawRefreshToken);
      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      res.clearCookie('dataflow_at', {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      res.json({
        success: true,
        message: 'Logout berhasil.',
      });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        });
        return;
      }
      const user = await authService.getUserById(req.user.userId || req.user.id);
      const isTrialActive = await trialModeService.isTrialActive();
      const trialInfo = isTrialActive ? await trialModeService.getTrialModeStatus() : null;
      res.json({
        success: true,
        data: {
          user: {
            ...user,
            isPremium: isTrialActive || user.role === 'PREMIUM' || user.role === 'SUPERADMIN',
            isGlobalTrialActive: isTrialActive,
            globalTrialEndAt: trialInfo?.endAt || null,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
        });
        return;
      }
      const user = await authService.updateUser(req.user.userId || req.user.id, req.body);
      res.json({
        success: true,
        data: { user },
        message: 'Profil berhasil diperbarui.',
      });
    } catch (err) {
      next(err);
    }
  }

  async uploadAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const file = (req as any).file;
      if (!file || !file.buffer) {
        res.status(400).json({ success: false, message: 'File foto profil tidak ditemukan.' });
        return;
      }
      const userId = req.user.userId || req.user.id;
      const { processAndStoreAvatar } = await import('./avatar.helper');
      const result = await processAndStoreAvatar(file.buffer, userId);
      const updatedUser = await authService.updateUser(userId, { avatarUrl: result.publicUrl });

      res.json({
        success: true,
        data: {
          avatarUrl: result.publicUrl,
          user: updatedUser,
        },
        message: 'Foto profil berhasil diperbarui.',
      });
    } catch (err: any) {
      if (err.message && (err.message.includes('2MB') || err.message.includes('Format') || err.message.includes('gambar'))) {
        res.status(400).json({ success: false, message: err.message, error: { message: err.message } });
        return;
      }
      next(err);
    }
  }

  async deleteAvatar(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const userId = req.user.userId || req.user.id;
      const { deleteUserAvatar } = await import('./avatar.helper');
      await deleteUserAvatar(userId);
      const updatedUser = await authService.updateUser(userId, { avatarUrl: null });

      res.json({
        success: true,
        data: {
          avatarUrl: null,
          user: updatedUser,
        },
        message: 'Foto profil berhasil dihapus.',
      });
    } catch (err) {
      next(err);
    }
  }

  async serveAvatar(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;
      const cleanFilename = path.basename(filename);
      const fs = await import('fs');
      const filePath = path.join(process.cwd(), 'public', 'uploads', 'avatars', cleanFilename);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, message: 'Avatar not found' });
        return;
      }
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.status(500).json({ success: false, message: 'Failed to serve avatar' });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const userId = req.user.userId || req.user.id;
      const currentRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = await authService.changePassword({
        userId,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword,
        currentRefreshToken,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async exportUserData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const userId = req.user.userId || req.user.id;
      const data = await authService.exportUserData(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
      }
      const userId = req.user.userId || req.user.id;
      const result = await authService.deleteAccount({
        userId,
        password: req.body.password,
        confirmText: req.body.confirmText,
      });

      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();

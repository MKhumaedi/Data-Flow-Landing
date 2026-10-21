import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtTokenPayload } from '../lib/jwt';
import { authService } from '../features/auth/auth.service';

export interface AuthenticatedRequest extends Request {
  user?: JwtTokenPayload;
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  // Cookie fallback
  const cookieAccessToken = (req as any).cookies?.dataflow_at;
  if (cookieAccessToken) {
    const payload = verifyAccessToken(cookieAccessToken);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  next();
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if ((req as any).cookies?.dataflow_at) {
    token = (req as any).cookies.dataflow_at;
  } else if (req.query?.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  // Fallback: Check if active refresh token cookie exists (dataflow_rt)
  const refreshToken = (req as any).cookies?.dataflow_rt;
  if (refreshToken) {
    try {
      const session = await authService.refreshAccessToken(refreshToken);
      if (session?.user && session?.accessToken) {
        req.user = {
          id: session.user.id,
          userId: session.user.id,
          email: session.user.email,
          role: session.user.role,
          verificationStatus: session.user.verificationStatus,
        };
        // Set new access token cookie and header for the client
        res.setHeader('x-refreshed-access-token', session.accessToken);
        res.cookie('dataflow_at', session.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 15 * 60 * 1000,
        });
        return next();
      }
    } catch {
      // Refresh token failed
    }
  }

  if (!authHeader && !token && !refreshToken) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token otentikasi tidak ditemukan atau tidak valid.',
      },
    });
    return;
  }

  res.status(401).json({
    success: false,
    error: {
      code: 'TOKEN_EXPIRED_OR_INVALID',
      message: 'Sesi akses Anda telah berakhir. Silakan login kembali.',
    },
  });
}

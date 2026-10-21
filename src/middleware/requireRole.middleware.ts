import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Role-checking middleware factory
 * E.g. requireRole(['SUPERADMIN']) or requireRole(['PREMIUM', 'SUPERADMIN'])
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Otentikasi diperlukan untuk mengakses sumber daya ini.',
        },
      });
      return;
    }

    const userRole = (req.user.role || '').toUpperCase();
    const hasRole = allowedRoles.some((role) => role.toUpperCase() === userRole);

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Akses ditolak. Anda tidak memiliki izin role yang diperlukan.',
          requiredRoles: allowedRoles,
          currentRole: req.user.role,
        },
      });
      return;
    }

    next();
  };
}

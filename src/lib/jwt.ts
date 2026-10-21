import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export interface JwtTokenPayload {
  id: string;
  userId: string;
  email: string;
  role: 'FREE' | 'PREMIUM' | 'SUPERADMIN' | string;
  verificationStatus?: 'VERIFIED' | 'PENDING' | string;
}

export function signAccessToken(payload: {
  id?: string;
  userId?: string;
  email: string;
  role: string;
  verificationStatus?: string;
}): string {
  const normalizedPayload: JwtTokenPayload = {
    id: payload.id || payload.userId || '',
    userId: payload.userId || payload.id || '',
    email: payload.email,
    role: payload.role,
    verificationStatus: payload.verificationStatus,
  };
  return jwt.sign(normalizedPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m',
    issuer: 'dataflow.api',
    audience: 'dataflow.web',
  });
}

export function signRefreshToken(payload: { id?: string; userId?: string; email: string; role: string }): string {
  const normalizedPayload: JwtTokenPayload = {
    id: payload.id || payload.userId || '',
    userId: payload.userId || payload.id || '',
    email: payload.email,
    role: payload.role,
  };
  return jwt.sign(normalizedPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
    issuer: 'dataflow.api',
    audience: 'dataflow.web',
  });
}

export function verifyAccessToken(token: string): JwtTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'dataflow.api',
      audience: 'dataflow.web',
    }) as JwtTokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtTokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'dataflow.api',
      audience: 'dataflow.web',
    }) as JwtTokenPayload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

import { prisma } from '../../../lib/prisma';
import { logger } from '../../../lib/logger';

export interface AdminAuditLogEntry {
  id?: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, any> | string;
  createdAt?: Date | string;
}

// In-memory fallback array to guarantee logging even if db is disconnected
const inMemoryAuditLogs: AdminAuditLogEntry[] = [];

/**
 * Shared Immutable Audit Logger for SUPERADMIN Actions
 * Must be called by all mutating operations across Admin modules.
 */
export async function logAdminAction(entry: AdminAuditLogEntry): Promise<void> {
  const normalizedEntry = {
    adminId: entry.adminId || 'system-admin',
    adminEmail: entry.adminEmail || 'admin@maystudio.app',
    action: entry.action.toUpperCase(),
    targetType: entry.targetType.toUpperCase(),
    targetId: entry.targetId || null,
    details: typeof entry.details === 'object' ? entry.details : { message: entry.details || '' },
    createdAt: new Date(),
  };

  try {
    if (prisma?.adminAuditLog?.create) {
      await prisma.adminAuditLog.create({
        data: normalizedEntry,
      });
    }
  } catch (err: any) {
    logger.warn(`[AuditLog Fallback] Failed to write to database: ${err?.message || err}`);
  }

  // Always keep in memory store as well for instant querying
  inMemoryAuditLogs.unshift({
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...normalizedEntry,
  });

  logger.info(
    `[ADMIN AUDIT] [${normalizedEntry.action}] Admin: ${normalizedEntry.adminEmail} | Target: ${normalizedEntry.targetType}:${normalizedEntry.targetId}`
  );
}

export function getInMemoryAuditLogs(): AdminAuditLogEntry[] {
  return inMemoryAuditLogs;
}

import { prisma } from '../../../lib/prisma';
import { getInMemoryAuditLogs, AdminAuditLogEntry } from './audit.helper';

export interface AuditQueryFilter {
  admin?: string;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class AuditService {
  async listLogs(filter: AuditQueryFilter) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const searchAdmin = filter.admin?.toLowerCase().trim();
    const searchAction = filter.action?.toUpperCase().trim();
    const searchTarget = filter.targetType?.toUpperCase().trim();

    let logs: AdminAuditLogEntry[] = [];

    try {
      if (prisma?.adminAuditLog?.findMany) {
        const dbLogs = await prisma.adminAuditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
        if (dbLogs && dbLogs.length > 0) {
          logs = dbLogs;
        }
      }
    } catch {
      // Fallback to memory
    }

    if (logs.length === 0) {
      logs = getInMemoryAuditLogs();
    }

    // Filter
    let filtered = logs.filter((log) => {
      if (searchAdmin && !log.adminEmail?.toLowerCase().includes(searchAdmin)) {
        return false;
      }
      if (searchAction && searchAction !== 'ALL' && log.action !== searchAction) {
        return false;
      }
      if (searchTarget && searchTarget !== 'ALL' && log.targetType !== searchTarget) {
        return false;
      }
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        const itemTime = new Date(log.createdAt || '').getTime();
        if (itemTime < start) return false;
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate).getTime();
        const itemTime = new Date(log.createdAt || '').getTime();
        if (itemTime > end) return false;
      }
      return true;
    });

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return {
      logs: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUserAuditLogs(userId: string, userEmail?: string, limit = 10): Promise<AdminAuditLogEntry[]> {
    let logs: AdminAuditLogEntry[] = [];
    try {
      if (prisma?.adminAuditLog?.findMany) {
        const dbLogs = await prisma.adminAuditLog.findMany({
          where: { targetId: userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });
        if (dbLogs && dbLogs.length > 0) {
          logs = dbLogs;
        }
      }
    } catch {
      // Fallback
    }

    if (logs.length === 0) {
      const memoryLogs = getInMemoryAuditLogs();
      const normalizedEmail = userEmail?.toLowerCase().trim();
      logs = memoryLogs.filter((l) => {
        if (l.targetId === userId) return true;
        if (normalizedEmail && typeof l.details === 'object') {
          return JSON.stringify(l.details).toLowerCase().includes(normalizedEmail);
        }
        return false;
      });
    }

    return logs.slice(0, limit);
  }
}

export const auditService = new AuditService();

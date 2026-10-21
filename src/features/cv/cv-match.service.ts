import { prisma } from '../../lib/prisma';
import { ensurePrismaUser } from '../../lib/db-helpers';
import { CVMatchRequest, CVMatchResult, CVQuotaInfo } from './cv.types';
import { requestCVMatchAnalysis } from './ai-provider';

interface MemoryUsageLog {
  userId: string;
  feature: string;
  createdAt: Date;
}

const memoryLogs: MemoryUsageLog[] = [];

export class CVMatchService {
  private FREE_MONTHLY_LIMIT = 3;

  private getStartOfCurrentMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  async getMonthlyUsage(userId: string, isPremium: boolean): Promise<CVQuotaInfo> {
    const startOfMonth = this.getStartOfCurrentMonth();
    let usedCount = 0;

    try {
      if (prisma?.aIUsageLog?.count) {
        usedCount = await prisma.aIUsageLog.count({
          where: {
            userId,
            feature: 'cv_match',
            createdAt: { gte: startOfMonth },
          },
        });
      } else {
        usedCount = memoryLogs.filter(
          (log) => log.userId === userId && log.feature === 'cv_match' && log.createdAt >= startOfMonth
        ).length;
      }
    } catch {
      usedCount = memoryLogs.filter(
        (log) => log.userId === userId && log.feature === 'cv_match' && log.createdAt >= startOfMonth
      ).length;
    }

    if (isPremium) {
      return {
        used: usedCount,
        limit: 9999,
        remaining: 9999,
        isPremium: true,
      };
    }

    return {
      used: usedCount,
      limit: this.FREE_MONTHLY_LIMIT,
      remaining: Math.max(0, this.FREE_MONTHLY_LIMIT - usedCount),
      isPremium: false,
    };
  }

  async analyzeCVMatch(
    userId: string,
    role: string,
    request: CVMatchRequest
  ): Promise<{ result: CVMatchResult; quota: CVQuotaInfo }> {
    const isPremium = role === 'PREMIUM' || role === 'SUPERADMIN';
    const currentQuota = await this.getMonthlyUsage(userId, isPremium);

    if (!isPremium && currentQuota.remaining <= 0) {
      throw {
        statusCode: 403,
        code: 'AI_QUOTA_EXCEEDED',
        message: 'Anda telah menggunakan 3 dari 3 analisis gratis bulan ini. Kuota akan direset pada tanggal 1 bulan depan, atau upgrade ke Premium untuk analisis tanpa batas.',
        quota: currentQuota,
      };
    }

    if (!request.jobDescription || request.jobDescription.trim().length < 10) {
      throw {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Deskripsi lowongan pekerjaan minimal 10 karakter.',
      };
    }

    // Call real LLM without persisting job description or CV text
    const result = await requestCVMatchAnalysis(request);

    // Only record usage upon successful completion
    try {
      const dbUserId = await ensurePrismaUser(userId);
      if (prisma?.aIUsageLog?.create) {
        await prisma.aIUsageLog.create({
          data: {
            userId: dbUserId,
            feature: 'cv_match',
          },
        });
      }
    } catch (err: any) {
      console.warn('Could not persist to AIUsageLog table, saving in-memory:', err?.message || err);
    }

    memoryLogs.push({
      userId,
      feature: 'cv_match',
      createdAt: new Date(),
    });

    const updatedQuota = await this.getMonthlyUsage(userId, isPremium);

    return {
      result,
      quota: updatedQuota,
    };
  }
}

export const cvMatchService = new CVMatchService();

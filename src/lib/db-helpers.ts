import { prisma } from './prisma';

/**
 * Ensures that a user ID exists in the Prisma User table to satisfy foreign key constraints.
 * Resolves user aliases (like usr-edi, usr-superadmin, usr-bagus, usr-alex-chen) to their corresponding DB users,
 * or safely creates a record if none exists.
 */
export async function ensurePrismaUser(userId: string): Promise<string> {
  if (!prisma?.user) return userId;

  try {
    // 1. Direct check by ID
    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (existing) return existing.id;

    // 2. Known alias resolution
    let targetEmail: string | null = null;
    let fallbackName = 'MayStudio User';
    let fallbackRole = 'FREE';

    if (userId === 'usr-superadmin') {
      targetEmail = 'superadmin@maystudio.id';
      fallbackName = 'Super Admin';
      fallbackRole = 'SUPERADMIN';
    } else if (userId === 'usr-edi' || userId === 'usr-edi-khumaedi') {
      targetEmail = 'edikhumaedi233@gmail.com';
      fallbackName = 'Edi Khumaedi';
      fallbackRole = 'PREMIUM';
    } else if (userId === 'usr-bagus') {
      targetEmail = 'bagus@gmail.com';
      fallbackName = 'Bagus (Free User)';
      fallbackRole = 'FREE';
    } else if (userId === 'usr-alex-chen') {
      targetEmail = 'alex.chen@maystudio.id';
      fallbackName = 'Alex Chen';
      fallbackRole = 'FREE';
    }

    if (targetEmail) {
      const byEmail = await prisma.user.findUnique({ where: { email: targetEmail } });
      if (byEmail) return byEmail.id;
    }

    // 3. Create user record to satisfy foreign key constraints
    const emailToUse = targetEmail || `${userId.replace(/[^a-zA-Z0-9]/g, '')}@maystudio.local`;
    const defaultPasswordHash = '$2b$10$tr8qsWyHJwPWPL2vFH4O9uhE81eR/cLqg3USC4tDA0HZVtud219.y';

    const created = await prisma.user.create({
      data: {
        id: userId,
        email: emailToUse,
        name: fallbackName,
        passwordHash: defaultPasswordHash,
        role: fallbackRole as any,
        verificationStatus: 'VERIFIED',
      },
    });

    return created.id;
  } catch (err: any) {
    // If unique constraint error on email/id, fetch the existing record or first available user
    try {
      const fallbackUser = await prisma.user.findFirst();
      if (fallbackUser) return fallbackUser.id;
    } catch {
      // Ignored
    }
    return userId;
  }
}

/**
 * Ensures that a dataset ID exists in the Prisma Dataset table for a given user.
 */
export async function ensurePrismaDataset(
  datasetId: string,
  userId: string,
  meta?: { fileName?: string; fileSize?: number; rowCount?: number; columns?: any[] }
): Promise<string> {
  if (!prisma?.dataset) return datasetId;

  try {
    const verifiedUserId = await ensurePrismaUser(userId);

    const existing = await prisma.dataset.findUnique({ where: { id: datasetId } });
    if (existing) {
      return existing.id;
    }

    await prisma.dataset.create({
      data: {
        id: datasetId,
        userId: verifiedUserId,
        fileName: meta?.fileName || `Dataset_${datasetId}.xlsx`,
        fileSize: meta?.fileSize || 20480,
        rowCount: meta?.rowCount || 100,
        columns: (meta?.columns as any) || [],
      },
    });

    return datasetId;
  } catch (err: any) {
    console.warn('ensurePrismaDataset warning:', err?.message || err);
    return datasetId;
  }
}

/**
 * Ensures a template ID is valid or falls back to 'minimal-teal'.
 */
export async function ensurePrismaTemplate(templateId?: string): Promise<string> {
  const defaultTemplate = 'minimal-teal';
  if (!templateId || !prisma?.dashboardTemplate) return defaultTemplate;

  try {
    const existing = await prisma.dashboardTemplate.findUnique({ where: { id: templateId } });
    if (existing) return existing.id;
    return defaultTemplate;
  } catch {
    return defaultTemplate;
  }
}

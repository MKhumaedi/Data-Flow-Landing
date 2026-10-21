import bcrypt from 'bcryptjs';
import { prisma } from '../../../lib/prisma';
import { authService } from '../../auth/auth.service';
import { logAdminAction } from '../audit-log/audit.helper';
import { auditService } from '../audit-log/audit.service';
import { transactionsService } from '../transactions/transactions.service';
import { notificationService } from '../../notifications/notification.service';
import { UserFilterParams, CreateAdminUserParams, EditAdminUserParams, AdminActor } from './user-admin.types';
import { validateCreateUserData, validateEditUserData } from './user-admin.validator';

const BCRYPT_SALT_ROUNDS = 10;

function generateSecurePassword(length = 10): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  let pass = '';
  pass += upper.charAt(Math.floor(Math.random() * upper.length));
  pass += lower.charAt(Math.floor(Math.random() * lower.length));
  pass += digits.charAt(Math.floor(Math.random() * digits.length));
  pass += symbols.charAt(Math.floor(Math.random() * symbols.length));
  for (let i = 4; i < length; i++) {
    pass += all.charAt(Math.floor(Math.random() * all.length));
  }
  return pass;
}

export class UserAdminService {
  private suspendedUserIds: Set<string> = new Set();

  async listUsers(params: UserFilterParams) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const search = params.search?.toLowerCase().trim();
    const roleFilter = params.role?.toUpperCase();
    const verificationFilter = params.verificationStatus?.toUpperCase();
    const showDeleted = Boolean(params.showDeleted);

    let usersList: any[] = [];

    try {
      if (prisma?.user?.findMany) {
        usersList = await prisma.user.findMany({
          where: showDeleted ? {} : { deletedAt: null },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            verificationStatus: true,
            verifiedAt: true,
            verifiedBy: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            _count: {
              select: { dashboards: true, datasets: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch {
      // Fallback
    }

    if (usersList.length === 0) {
      const memoryUsers = authService.getUsers();
      usersList = memoryUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        verificationStatus: u.verificationStatus || 'PENDING',
        verifiedAt: u.verifiedAt || null,
        verifiedBy: u.verifiedBy || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
        deletedAt: u.deletedAt,
        _count: {
          dashboards: u.dashboardCount || (u.role === 'PREMIUM' ? 8 : 2),
          datasets: u.role === 'PREMIUM' ? 6 : 2,
        },
      }));
    }

    const filtered = usersList.filter((u) => {
      if (!showDeleted && u.deletedAt) return false;
      if (showDeleted && !u.deletedAt) return false;

      const isSuspended = this.suspendedUserIds.has(u.id);
      if (params.statusFilter === 'ACTIVE' && isSuspended) return false;
      if (params.statusFilter === 'SUSPENDED' && !isSuspended) return false;

      if (search && !u.email.toLowerCase().includes(search) && !u.name.toLowerCase().includes(search)) {
        return false;
      }
      if (roleFilter && roleFilter !== 'ALL' && u.role !== roleFilter) {
        return false;
      }
      if (verificationFilter && verificationFilter !== 'ALL' && u.verificationStatus !== verificationFilter) {
        return false;
      }
      return true;
    });

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit).map((u) => ({
      ...u,
      verificationStatus: u.verificationStatus || 'PENDING',
      verifiedAt: u.verifiedAt || null,
      verifiedBy: u.verifiedBy || null,
      isSuspended: this.suspendedUserIds.has(u.id),
      plan: u.role === 'PREMIUM' ? 'pro' : u.role === 'SUPERADMIN' ? 'enterprise' : 'free',
      dashboardsCount: u._count?.dashboards || 0,
      datasetsCount: u._count?.datasets || 0,
    }));

    return {
      users: paginated,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getUserDetail(userId: string) {
    let foundUser: any = null;

    try {
      if (prisma?.user?.findUnique) {
        foundUser = await prisma.user.findUnique({
          where: { id: userId },
          includeDeleted: true,
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            verificationStatus: true,
            verifiedAt: true,
            verifiedBy: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            _count: {
              select: { dashboards: true, datasets: true },
            },
          },
        });
      }
    } catch {
      // Fallback
    }

    if (!foundUser) {
      const memoryUsers = authService.getUsers();
      const mem = memoryUsers.find((u) => u.id === userId);
      if (mem) {
        foundUser = {
          id: mem.id,
          email: mem.email,
          name: mem.name,
          role: mem.role,
          verificationStatus: mem.verificationStatus || 'PENDING',
          verifiedAt: mem.verifiedAt || null,
          verifiedBy: mem.verifiedBy || null,
          createdAt: mem.createdAt,
          updatedAt: mem.updatedAt,
          deletedAt: mem.deletedAt,
          _count: {
            dashboards: mem.dashboardCount || (mem.role === 'PREMIUM' ? 8 : 2),
            datasets: mem.role === 'PREMIUM' ? 6 : 2,
          },
        };
      }
    }

    if (!foundUser) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan.' };
    }

    const [allTrx, userAuditLogs] = await Promise.all([
      transactionsService.listTransactions({ search: foundUser.email }),
      auditService.getUserAuditLogs(foundUser.id, foundUser.email, 10),
    ]);

    const userTransactions = allTrx.filter(
      (t) => t.userEmail.toLowerCase() === foundUser.email.toLowerCase()
    );

    return {
      ...foundUser,
      plan: foundUser.role === 'PREMIUM' ? 'pro' : foundUser.role === 'SUPERADMIN' ? 'enterprise' : 'free',
      isSuspended: this.suspendedUserIds.has(foundUser.id),
      dashboardsCount: foundUser._count?.dashboards || 0,
      datasetsCount: foundUser._count?.datasets || 0,
      transactions: userTransactions,
      auditLogs: userAuditLogs,
    };
  }

  async createUser(admin: AdminActor, data: CreateAdminUserParams) {
    const { isValid, errors, normalizedEmail } = validateCreateUserData(data);
    if (!isValid) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: Object.values(errors)[0], errors };
    }

    // Check duplicate email
    let isExisting = false;
    try {
      if (prisma?.user?.findUnique) {
        const check = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          includeDeleted: true,
        });
        if (check) isExisting = true;
      }
    } catch {
      // Fallback
    }

    if (!isExisting) {
      const memoryUsers = authService.getUsers();
      if (memoryUsers.some((u) => u.email.toLowerCase() === normalizedEmail)) {
        isExisting = true;
      }
    }

    if (isExisting) {
      throw {
        statusCode: 400,
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email sudah terdaftar.',
        errors: { email: 'Email sudah terdaftar dalam sistem.' },
      };
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);
    const userId = 'usr-' + Math.random().toString(36).substring(2, 11);
    const role = data.role || 'FREE';
    const verificationStatus = data.verificationStatus || 'VERIFIED';
    const isVerified = verificationStatus === 'VERIFIED';
    const now = new Date();

    const newUserRecord = {
      id: userId,
      name: data.name.trim(),
      email: normalizedEmail,
      role,
      verificationStatus,
      verifiedAt: isVerified ? now.toISOString() : null,
      verifiedBy: isVerified ? admin.email : null,
      title: 'Data Analyst',
      plan: (role === 'PREMIUM' ? 'pro' : role === 'SUPERADMIN' ? 'enterprise' : 'free') as any,
      twoFactorEnabled: false,
      localProcessingOnly: true,
      dashboardCount: 0,
      maxDashboards: role === 'FREE' ? 3 : 9999,
      passwordHash,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
    };

    try {
      if (prisma?.user?.create) {
        await prisma.user.create({
          data: {
            id: newUserRecord.id,
            name: newUserRecord.name,
            email: newUserRecord.email,
            passwordHash: newUserRecord.passwordHash,
            role: newUserRecord.role as any,
            verificationStatus: newUserRecord.verificationStatus as any,
            verifiedAt: isVerified ? now : null,
            verifiedBy: isVerified ? admin.email : null,
          },
        });
      }
    } catch {
      // Fallback
    }

    authService.addUser(newUserRecord);

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_CREATED_BY_ADMIN',
      targetType: 'USER',
      targetId: userId,
      details: {
        name: newUserRecord.name,
        email: newUserRecord.email,
        role: newUserRecord.role,
        verificationStatus: newUserRecord.verificationStatus,
        createdBy: admin.email,
      },
    });

    const { passwordHash: _hash, ...cleanUser } = newUserRecord;
    return {
      ...cleanUser,
      dashboardsCount: 0,
      datasetsCount: 0,
      isSuspended: false,
    };
  }

  async updateUserRole(admin: AdminActor, targetUserId: string, newRole: 'FREE' | 'PREMIUM' | 'SUPERADMIN') {
    let prevRole = 'FREE';
    try {
      if (prisma?.user?.update) {
        const updated = await prisma.user.update({
          where: { id: targetUserId },
          data: { role: newRole as any },
        });
        prevRole = updated.role;
      }
    } catch {
      // Fallback
    }

    const extraUpdates: any = {};
    let formattedExpiry = '';
    if (newRole === 'PREMIUM') {
      const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      extraUpdates.premiumExpiresAt = expiry;
      formattedExpiry = new Date(expiry).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }

    await authService.updateUser(targetUserId, {
      role: newRole,
      plan: newRole === 'PREMIUM' ? 'pro' : newRole === 'SUPERADMIN' ? 'enterprise' : 'free',
      maxDashboards: newRole === 'FREE' ? 3 : 9999,
      ...extraUpdates,
    }).catch(() => null);

    // Send real-time notification to user
    if (newRole === 'PREMIUM') {
      await notificationService.createNotification({
        scope: 'USER',
        userId: targetUserId,
        user_id: targetUserId,
        type: 'FEATURE_UPDATE',
        title: 'Akun Di-upgrade ke Premium!',
        message: `Masa aktif akun Anda telah diperbarui menjadi Premium aktif hingga ${formattedExpiry}.`,
        link: '/riwayat-transaksi',
      }).catch(() => null);
    } else if (newRole === 'FREE' && prevRole === 'PREMIUM') {
      await notificationService.createNotification({
        scope: 'USER',
        userId: targetUserId,
        user_id: targetUserId,
        type: 'PREMIUM_EXPIRED',
        title: 'Status Paket Berubah',
        message: 'Status paket akun Anda telah diubah kembali ke akun standar (Free).',
        link: '/harga',
      }).catch(() => null);
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_ROLE_CHANGED',
      targetType: 'USER',
      targetId: targetUserId,
      details: { newRole, previousRole: prevRole },
    });

    return { success: true, targetUserId, newRole };
  }

  async updateUserStatus(admin: AdminActor, targetUserId: string, isSuspended: boolean) {
    if (isSuspended) {
      this.suspendedUserIds.add(targetUserId);
    } else {
      this.suspendedUserIds.delete(targetUserId);
    }

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isSuspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      targetType: 'USER',
      targetId: targetUserId,
      details: { isSuspended },
    });

    return { success: true, targetUserId, isSuspended };
  }

  async updateUserVerification(
    admin: AdminActor,
    targetUserId: string,
    status: 'VERIFIED' | 'PENDING' | 'REJECTED'
  ) {
    const verifiedAt = status === 'VERIFIED' ? new Date().toISOString() : null;
    const verifiedBy = status === 'VERIFIED' ? admin.email : null;

    try {
      if (prisma?.user?.update) {
        await prisma.user.update({
          where: { id: targetUserId },
          data: {
            verificationStatus: status,
            verifiedAt: status === 'VERIFIED' ? new Date() : null,
            verifiedBy: status === 'VERIFIED' ? admin.email : null,
          },
        });
      }
    } catch {
      // Fallback
    }

    await authService.updateUser(targetUserId, {
      verificationStatus: status,
      verifiedAt,
      verifiedBy,
    }).catch(() => null);

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_VERIFICATION_UPDATED',
      targetType: 'USER',
      targetId: targetUserId,
      details: { verificationStatus: status, verifiedBy: admin.email },
    });

    return { success: true, targetUserId, verificationStatus: status, verifiedAt, verifiedBy };
  }

  async softDeleteUser(admin: AdminActor, targetUserId: string) {
    await authService.deleteUser(targetUserId);

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_SOFT_DELETED',
      targetType: 'USER',
      targetId: targetUserId,
      details: { softDelete: true },
    });

    return { success: true, targetUserId };
  }

  async restoreUser(admin: AdminActor, targetUserId: string) {
    const restored = await authService.restoreUser(targetUserId);

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_RESTORED',
      targetType: 'USER',
      targetId: targetUserId,
      details: { restored: true },
    });

    return { success: true, targetUserId, user: restored };
  }

  async editUserProfile(admin: AdminActor, targetUserId: string, data: EditAdminUserParams) {
    const { isValid, errors, normalizedEmail, trimmedName } = validateEditUserData(data);
    if (!isValid) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: Object.values(errors)[0], errors };
    }

    // 1. Fetch current user data
    const current = await this.getUserDetail(targetUserId);
    if (!current) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan.' };
    }

    const changes: Record<string, { from: string; to: string }> = {};
    const updates: { name?: string; email?: string } = {};

    if (trimmedName && trimmedName !== current.name) {
      changes.name = { from: current.name, to: trimmedName };
      updates.name = trimmedName;
    }

    if (normalizedEmail && normalizedEmail !== current.email.toLowerCase()) {
      // 2. Validate email uniqueness across other users
      let isTaken = false;
      try {
        if (prisma?.user?.findUnique) {
          const check = await prisma.user.findUnique({
            where: { email: normalizedEmail },
            includeDeleted: true,
          });
          if (check && check.id !== targetUserId) {
            isTaken = true;
          }
        }
      } catch {
        // Fallback
      }

      if (!isTaken) {
        const memoryUsers = authService.getUsers();
        const conflict = memoryUsers.find(
          (u) => u.email.toLowerCase() === normalizedEmail && u.id !== targetUserId
        );
        if (conflict) {
          isTaken = true;
        }
      }

      if (isTaken) {
        throw {
          statusCode: 400,
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Alamat email sudah digunakan oleh pengguna lain.',
          errors: { email: 'Alamat email sudah terdaftar dalam sistem.' },
        };
      }

      changes.email = { from: current.email, to: normalizedEmail };
      updates.email = normalizedEmail;
    }

    // If nothing changed, return current without modifying
    if (Object.keys(changes).length === 0) {
      return {
        ...current,
        message: 'Tidak ada perubahan data.',
      };
    }

    const now = new Date();

    // 3. Update database (Prisma) strictly name/email
    try {
      if (prisma?.user?.update) {
        await prisma.user.update({
          where: { id: targetUserId },
          data: {
            ...(updates.name ? { name: updates.name } : {}),
            ...(updates.email ? { email: updates.email } : {}),
            updatedAt: now,
          },
        });
      }
    } catch {
      // Handled
    }

    // 4. Update in-memory user store
    const memoryUsers = authService.getUsers();
    const memUser = memoryUsers.find((u) => u.id === targetUserId);
    if (memUser) {
      const oldEmailKey = memUser.email.toLowerCase();
      if (updates.name) memUser.name = updates.name;
      if (updates.email) {
        memUser.email = updates.email;
        (authService as any).users.delete(oldEmailKey);
      }
      memUser.updatedAt = now.toISOString();
      (authService as any).users.set(memUser.email.toLowerCase(), memUser);
    }

    // 5. Write audit log entry with detailed field-level delta
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_PROFILE_EDITED_BY_ADMIN',
      targetType: 'USER',
      targetId: targetUserId,
      details: {
        changes,
        editedBy: admin.email,
        targetEmail: updates.email || current.email,
      },
    });

    return {
      ...current,
      ...updates,
      updatedAt: now.toISOString(),
    };
  }

  async resetUserPassword(admin: AdminActor, targetUserId: string, customPassword?: string) {
    const current = await this.getUserDetail(targetUserId);
    if (!current) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'Pengguna tidak ditemukan.' };
    }

    const rawPassword = customPassword || generateSecurePassword(10);
    const passwordHash = await bcrypt.hash(rawPassword, BCRYPT_SALT_ROUNDS);
    const now = new Date();

    try {
      if (prisma?.user?.update) {
        await prisma.user.update({
          where: { id: targetUserId },
          data: {
            passwordHash,
            updatedAt: now,
          },
        });
      }
    } catch {
      // Handled
    }

    const memoryUsers = authService.getUsers();
    const memUser = memoryUsers.find((u) => u.id === targetUserId);
    if (memUser) {
      memUser.passwordHash = passwordHash;
      memUser.updatedAt = now.toISOString();
      (authService as any).users.set(memUser.email.toLowerCase(), memUser);
    }

    // Write separate audit log entry for password reset
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_PASSWORD_RESET_BY_ADMIN',
      targetType: 'USER',
      targetId: targetUserId,
      details: {
        resetBy: admin.email,
        targetEmail: current.email,
      },
    });

    return {
      success: true,
      targetUserId,
      rawPassword,
      message: 'Kata sandi pengguna berhasil direset.',
    };
  }
}

export const userAdminService = new UserAdminService();

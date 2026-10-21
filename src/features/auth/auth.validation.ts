import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2, 'Nama lengkap minimal 2 karakter').max(100),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter'),
  title: z.string().optional(),
});

export const registerSchema = signupSchema;

export const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(100).optional(),
  title: z.string().max(100).optional(),
  avatarUrl: z.string().nullable().optional(),
  notificationPreferences: z.object({
    transactions: z.boolean().optional(),
    subscriptionReminders: z.boolean().optional(),
    contentUpdates: z.boolean().optional(),
  }).optional(),
  twoFactorEnabled: z.boolean().optional(),
  localProcessingOnly: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Kata sandi saat ini wajib diisi'),
  newPassword: z.string().min(8, 'Kata sandi baru minimal 8 karakter'),
  confirmPassword: z.string().min(8, 'Konfirmasi kata sandi minimal 8 karakter'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Konfirmasi kata sandi baru tidak cocok',
  path: ['confirmPassword'],
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Kata sandi wajib diisi untuk verifikasi'),
  confirmText: z.literal('HAPUS', {
    message: 'Ketik "HAPUS" untuk konfirmasi penghapusan akun',
  }),
});


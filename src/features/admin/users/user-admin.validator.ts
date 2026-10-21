import { CreateAdminUserParams, EditAdminUserParams } from './user-admin.types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCreateUserData(data: CreateAdminUserParams): {
  isValid: boolean;
  errors: Record<string, string>;
  normalizedEmail: string;
} {
  const errors: Record<string, string> = {};
  const normalizedEmail = (data?.email || '').trim().toLowerCase();

  if (!data?.name || data.name.trim().length < 2) {
    errors.name = 'Nama lengkap minimal 2 karakter.';
  }

  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.email = 'Format alamat email tidak valid.';
  }

  if (!data?.password || data.password.length < 6) {
    errors.password = 'Kata sandi minimal 6 karakter.';
  }

  if (data?.role && !['FREE', 'PREMIUM', 'SUPERADMIN'].includes(data.role)) {
    errors.role = 'Role yang dipilih tidak valid.';
  }

  if (
    data?.verificationStatus &&
    !['VERIFIED', 'PENDING', 'REJECTED'].includes(data.verificationStatus)
  ) {
    errors.verificationStatus = 'Status verifikasi tidak valid.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalizedEmail,
  };
}

export function validateEditUserData(data: EditAdminUserParams): {
  isValid: boolean;
  errors: Record<string, string>;
  normalizedEmail?: string;
  trimmedName?: string;
} {
  const errors: Record<string, string> = {};
  let normalizedEmail: string | undefined = undefined;
  let trimmedName: string | undefined = undefined;

  if (data.name !== undefined) {
    trimmedName = data.name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      errors.name = 'Nama lengkap minimal 2 karakter.';
    }
  }

  if (data.email !== undefined) {
    normalizedEmail = data.email.trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      errors.email = 'Format alamat email tidak valid.';
    }
  }

  if (data.name === undefined && data.email === undefined) {
    errors.general = 'Setidaknya satu data (nama atau email) harus diberikan.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalizedEmail,
    trimmedName,
  };
}

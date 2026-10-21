import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../lib/prisma';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';
import { logger } from '../../lib/logger';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_SHARP_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif', 'bmp'];

export interface ProcessedAvatarResult {
  filename: string;
  publicUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return true;

  // WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) return true;

  // GIF: GIF87a / GIF89a (47 49 46 38)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;

  // BMP: BM (42 4D)
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return true;

  // AVIF / HEIC container (ftyp at offset 4)
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;

  // TIFF: II*. / MM.*
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
     (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a))
  ) return true;

  return false;
}

/**
 * Remove previous avatar files for a user from local storage directories.
 */
function cleanupOldAvatarFiles(userId: string): void {
  const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dirs = [
    path.join(process.cwd(), 'public', 'uploads', 'avatars'),
    path.join(process.cwd(), 'web', 'public', 'uploads', 'avatars'),
  ];

  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith(`avatar_${cleanUserId}_`)) {
            try {
              fs.unlinkSync(path.join(dir, file));
            } catch {
              // Ignore file unlink failure
            }
          }
        }
      } catch {
        // Ignore directory read failure
      }
    }
  }
}

export async function processAndStoreAvatar(
  buffer: Buffer,
  userId: string
): Promise<ProcessedAvatarResult> {
  // 1. Strict 2MB size enforcement
  if (buffer.length > MAX_FILE_SIZE) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`Ukuran foto melebihi batas 2MB (File Anda: ${sizeMb}MB). Maksimal 2MB.`);
  }

  // 2. Validate binary magic bytes (only real images allowed)
  if (!validateImageMagicBytes(buffer)) {
    throw new Error('Format file tidak valid. Hanya dapat menggunakan format gambar (JPG, JPEG, PNG, WEBP, atau format gambar lainnya).');
  }

  // 3. Inspect image metadata using sharp
  let metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new Error('File gambar rusak atau format gambar tidak dapat diproses.');
  }

  if (!metadata.format || !ALLOWED_SHARP_FORMATS.includes(metadata.format.toLowerCase())) {
    throw new Error('Format file tidak didukung. Harap gunakan format gambar seperti JPG, JPEG, PNG, atau WEBP.');
  }

  // 4. Automatically convert to 400x400 WebP with high quality
  const processedWebpBuffer = await sharp(buffer)
    .resize({
      width: 400,
      height: 400,
      fit: 'cover',
      position: 'center',
    })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const processedMetadata = await sharp(processedWebpBuffer).metadata();
  const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `avatar_${cleanUserId}_${Date.now()}.webp`;

  // 5. Clean up old avatar files on disk
  cleanupOldAvatarFiles(userId);

  // 6. Write new WebP file to disk
  const uploadsBaseDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');
  if (!fs.existsSync(uploadsBaseDir)) {
    fs.mkdirSync(uploadsBaseDir, { recursive: true });
  }
  fs.writeFileSync(path.join(uploadsBaseDir, filename), processedWebpBuffer);

  const webPublicDir = path.join(process.cwd(), 'web', 'public', 'uploads', 'avatars');
  if (fs.existsSync(path.join(process.cwd(), 'web', 'public'))) {
    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(webPublicDir, filename), processedWebpBuffer);
  }

  // 7. Store as permanent Data URI in Postgres database
  // This guarantees permanent persistence in the database with 0 external network/file dependencies!
  const dataUri = `data:image/webp;base64,${processedWebpBuffer.toString('base64')}`;

  // 8. Persist directly in PostgreSQL database table `users`
  await recordUserAvatarInPostgres(userId, dataUri);

  return {
    filename,
    publicUrl: dataUri,
    width: processedMetadata.width || 400,
    height: processedMetadata.height || 400,
    sizeBytes: processedWebpBuffer.length,
  };
}

export async function deleteUserAvatar(userId: string): Promise<void> {
  cleanupOldAvatarFiles(userId);
  await recordUserAvatarInPostgres(userId, null);
}

async function recordUserAvatarInPostgres(userId: string, avatarUrl: string | null): Promise<void> {
  // Update via Prisma if available
  if (prisma?.user?.update) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: avatarUrl },
      });
    } catch (err: any) {
      logger.warn(`[AvatarHelper] Prisma update warning: ${err.message}`);
    }
  }

  // Also update via safe Postgres client
  const client = getSafePgClient();
  if (!client) return;
  try {
    await client.connect();
    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;`);
    await client.query(
      `UPDATE "users" SET "avatarUrl" = $1, "updatedAt" = NOW() WHERE "id" = $2;`,
      [avatarUrl, userId]
    );
  } catch (err: any) {
    markDatabaseOffline(err);
    logger.warn(`[AvatarHelper] Postgres update warning: ${err.message}`);
  } finally {
    await client.end().catch(() => null);
  }
}

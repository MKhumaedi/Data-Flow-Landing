import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { logger } from '../../lib/logger';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export interface ProcessedAdImageResult {
  filename: string;
  relativePath: string;
  publicUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  format: string;
}

export function validateImageMagicBytes(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return true;
  // GIF: GIF87a or GIF89a (47 49 46 38)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true;
  // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) return true;

  return false;
}

export function parseDimensions(dimStr?: string | null): { width?: number; height?: number } {
  if (!dimStr) return {};
  const match = dimStr.toLowerCase().match(/^(\d+)\s*[x×]\s*(\d+)$/);
  if (!match) return {};
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

export async function processAndStoreAdImage(
  buffer: Buffer,
  placementKey: string,
  dimensionsStr?: string | null
): Promise<ProcessedAdImageResult> {
  if (buffer.length > MAX_FILE_SIZE) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`Ukuran file melebihi batas 2MB (File Anda: ${sizeMb}MB).`);
  }

  if (!validateImageMagicBytes(buffer)) {
    throw new Error('Format file tidak valid. Hanya menerima gambar .jpg, .jpeg, .png, .gif, atau .webp.');
  }

  const sharpInstance = sharp(buffer);
  const metadata = await sharpInstance.metadata();

  if (!metadata.format || !ALLOWED_MIME_TYPES.includes(`image/${metadata.format}`)) {
    throw new Error('Format gambar tidak didukung atau file gambar rusak.');
  }

  const cleanPlacementKey = placementKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'default';
  const targetDim = parseDimensions(dimensionsStr);

  let pipeline = sharp(buffer);

  // Resize if image significantly exceeds placement recommended dimensions (cap at 2x)
  if (targetDim.width && targetDim.height) {
    const maxW = targetDim.width * 2;
    const maxH = targetDim.height * 2;
    pipeline = pipeline.resize({
      width: maxW,
      height: maxH,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Convert to WebP format with quality 80
  const processedWebpBuffer = await pipeline.webp({ quality: 80, effort: 4 }).toBuffer();
  const processedMetadata = await sharp(processedWebpBuffer).metadata();

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filename = `${cleanPlacementKey}_${timestamp}_${randomStr}.webp`;

  // Write to storage directory
  const uploadsBaseDir = path.join(process.cwd(), 'public', 'uploads', 'ad-images', cleanPlacementKey);
  if (!fs.existsSync(uploadsBaseDir)) {
    fs.mkdirSync(uploadsBaseDir, { recursive: true });
  }

  const filePath = path.join(uploadsBaseDir, filename);
  fs.writeFileSync(filePath, processedWebpBuffer);

  // Also sync to web/public if present
  const webPublicDir = path.join(process.cwd(), 'web', 'public', 'uploads', 'ad-images', cleanPlacementKey);
  if (fs.existsSync(path.join(process.cwd(), 'web', 'public'))) {
    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(webPublicDir, filename), processedWebpBuffer);
  }

  // Record in PostgreSQL Supabase storage tables
  await recordStorageObject(cleanPlacementKey, filename, processedWebpBuffer.length);

  const publicUrl = `/api/ads/images/${cleanPlacementKey}/${filename}`;

  return {
    filename,
    relativePath: `ad-images/${cleanPlacementKey}/${filename}`,
    publicUrl,
    width: processedMetadata.width || 0,
    height: processedMetadata.height || 0,
    sizeBytes: processedWebpBuffer.length,
    format: 'webp',
  };
}

export async function processAndStorePlacementPreview(
  buffer: Buffer,
  placementKey: string
): Promise<ProcessedAdImageResult> {
  if (buffer.length > MAX_FILE_SIZE * 2) {
    throw new Error('Ukuran preview melebihi batas 4MB.');
  }

  let pipeline = sharp(buffer);
  pipeline = pipeline.resize({
    width: 1200,
    fit: 'inside',
    withoutEnlargement: true,
  });

  const processedWebpBuffer = await pipeline.webp({ quality: 85, effort: 4 }).toBuffer();
  const processedMetadata = await sharp(processedWebpBuffer).metadata();

  const cleanPlacementKey = placementKey.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'default';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const filename = `preview_${cleanPlacementKey}_${timestamp}_${randomStr}.webp`;

  const previewsDir = path.join(process.cwd(), 'public', 'uploads', 'ad-images', 'previews');
  if (!fs.existsSync(previewsDir)) {
    fs.mkdirSync(previewsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(previewsDir, filename), processedWebpBuffer);

  const webPublicDir = path.join(process.cwd(), 'web', 'public', 'uploads', 'ad-images', 'previews');
  if (fs.existsSync(path.join(process.cwd(), 'web', 'public'))) {
    if (!fs.existsSync(webPublicDir)) {
      fs.mkdirSync(webPublicDir, { recursive: true });
    }
    fs.writeFileSync(path.join(webPublicDir, filename), processedWebpBuffer);
  }

  await recordStorageObject('previews', filename, processedWebpBuffer.length);
  const publicUrl = `/api/ads/images/previews/${filename}`;

  return {
    filename,
    relativePath: `ad-images/previews/${filename}`,
    publicUrl,
    width: processedMetadata.width || 0,
    height: processedMetadata.height || 0,
    sizeBytes: processedWebpBuffer.length,
    format: 'webp',
  };
}

async function recordStorageObject(placementKey: string, filename: string, sizeBytes: number) {
  const client = getSafePgClient();
  if (!client) return;
  try {
    await client.connect();
    await client.query(`
      INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
      VALUES ('ad-images', 'ad-images', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET public = true, updated_at = NOW();
    `);
    const objectPath = `${placementKey}/${filename}`;
    await client.query(`
      INSERT INTO storage.objects (id, bucket_id, name, created_at, updated_at, metadata)
      VALUES (
        gen_random_uuid(),
        'ad-images',
        $1,
        NOW(),
        NOW(),
        $2::jsonb
      )
      ON CONFLICT DO NOTHING
    `, [objectPath, JSON.stringify({ mimetype: 'image/webp', size: sizeBytes })]);
  } catch (err: any) {
    markDatabaseOffline(err);
  } finally {
    await client.end().catch(() => null);
  }
}

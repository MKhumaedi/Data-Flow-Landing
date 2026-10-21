import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { logger } from '../../lib/logger';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

export interface PexelsPhotoCandidate {
  id: number;
  url: string;
  previewUrl: string;
  photographer: string;
  photographerUrl: string;
  credit: string;
  width: number;
  height: number;
}

export interface StoredCoverResult {
  coverImageUrl: string;
  coverImageCredit: string;
}

const CATEGORY_TERMS: Record<string, string> = {
  'Tips Excel & Data': 'excel spreadsheet data analysis computer office',
  'Tips Excel': 'excel spreadsheet financial charts office table',
  'Karir & CV': 'job interview resume hiring corporate workplace',
  'Produktivitas Bisnis': 'business meeting document contract modern office',
  'Analitik & Data': 'data analytics business intelligence charts graphs',
  'Update Produk': 'modern digital software dashboard computer workspace',
};

export function buildSearchQuery(title: string, category: string, tags: string[] = []): string {
  const lowTitle = (title || '').toLowerCase();
  if (lowTitle.includes('pivot table') || lowTitle.includes('vlookup') || lowTitle.includes('xlookup')) {
    return 'excel spreadsheet formulas office work';
  }
  if (lowTitle.includes('membersihkan data') || lowTitle.includes('clean data')) {
    return 'spreadsheet data cleaning computer office';
  }
  if (lowTitle.includes('cv') || lowTitle.includes('resume') || lowTitle.includes('lamaran')) {
    return 'resume curriculum vitae job interview desk';
  }
  if (lowTitle.includes('gaji') || lowTitle.includes('negosiasi') || lowTitle.includes('interview')) {
    return 'job interview handshake business meeting';
  }
  if (lowTitle.includes('invoice') || lowTitle.includes('keuangan') || lowTitle.includes('kwitansi')) {
    return 'invoice accounting financial document office';
  }
  if (lowTitle.includes('sop') || lowTitle.includes('administrasi') || lowTitle.includes('operasional')) {
    return 'business operations document signing office';
  }
  if (lowTitle.includes('dashboard') || lowTitle.includes('analitik') || lowTitle.includes('visualisasi')) {
    return 'data analytics computer dashboard office';
  }
  return CATEGORY_TERMS[category] || tags.slice(0, 2).join(' ') || 'professional business office workspace';
}

export async function searchPexelsPhotos(query: string, perPage = 4): Promise<PexelsPhotoCandidate[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    logger.warn('[Pexels] PEXELS_API_KEY is not configured.');
    return [];
  }

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      logger.warn(`[Pexels] API error: ${res.status} ${res.statusText}`);
      return [];
    }
    const data: any = await res.json();
    if (!data.photos || !Array.isArray(data.photos)) return [];

    return data.photos.map((p: any) => ({
      id: p.id,
      url: p.src?.large || p.src?.medium || p.src?.original,
      previewUrl: p.src?.medium || p.src?.small || p.src?.tiny,
      photographer: p.photographer || 'Pexels Creator',
      photographerUrl: p.photographer_url || 'https://www.pexels.com',
      credit: `Photo by ${p.photographer || 'Pexels Creator'} on Pexels`,
      width: p.width || 1200,
      height: p.height || 675,
    }));
  } catch (err: any) {
    logger.warn(`[Pexels] Search fetch error: ${err.message}`);
    return [];
  }
}

async function fetchImageBuffer(imageUrl: string): Promise<Buffer> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

function getCategoryColor(category: string): { bg1: string; bg2: string; text: string } {
  const cat = (category || '').toLowerCase();
  if (cat.includes('excel') || cat.includes('data')) return { bg1: '#064e3b', bg2: '#047857', text: '#34d399' };
  if (cat.includes('karir') || cat.includes('cv')) return { bg1: '#1e3a8a', bg2: '#2563eb', text: '#93c5fd' };
  if (cat.includes('bisnis') || cat.includes('admin')) return { bg1: '#0f766e', bg2: '#0d9488', text: '#5eead4' };
  return { bg1: '#0f172a', bg2: '#334155', text: '#cbd5e1' };
}

export function generateBrandedPlaceholderSvg(title: string, category: string): Buffer {
  const colors = getCategoryColor(category);
  const safeTitle = (title || 'MayStudio Article').replace(/[<>&"]/g, '');
  const safeCat = (category || 'MayStudio Insight').toUpperCase().replace(/[<>&"]/g, '');
  const svg = `<svg width="1200" height="675" viewBox="0 0 1200 675" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colors.bg1}"/>
        <stop offset="100%" stop-color="${colors.bg2}"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="675" fill="url(#grad)"/>
    <circle cx="1050" cy="150" r="300" fill="white" fill-opacity="0.03"/>
    <circle cx="150" cy="550" r="220" fill="white" fill-opacity="0.03"/>
    <text x="80" y="240" fill="${colors.text}" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="700" letter-spacing="3">${safeCat}</text>
    <text x="80" y="320" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="800" width="1040">
      <tspan x="80" dy="0">${safeTitle.slice(0, 45)}</tspan>
      ${safeTitle.length > 45 ? `<tspan x="80" dy="55">${safeTitle.slice(45, 90)}</tspan>` : ''}
    </text>
    <text x="80" y="580" fill="#94a3b8" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="600">MayStudio.id • Panduan Praktis</text>
  </svg>`;
  return Buffer.from(svg);
}

async function recordInSupabaseStorage(filename: string, sizeBytes: number): Promise<void> {
  const client = getSafePgClient();
  if (!client) return;
  try {
    await client.connect();
    await client.query(`
      INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
      VALUES ('blog-covers', 'blog-covers', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET public = true, updated_at = NOW();
    `);
    await client.query(`
      INSERT INTO storage.objects (id, bucket_id, name, created_at, updated_at, metadata)
      VALUES (gen_random_uuid(), 'blog-covers', $1, NOW(), NOW(), $2::jsonb)
      ON CONFLICT DO NOTHING
    `, [filename, JSON.stringify({ mimetype: 'image/webp', size: sizeBytes })]);
  } catch (err: any) {
    markDatabaseOffline(err);
  } finally {
    try { await client.end(); } catch {}
  }
}

function writeBufferToUploads(filename: string, buffer: Buffer): void {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'blog-covers');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  fs.writeFileSync(path.join(uploadDir, filename), buffer);

  const webPublicDir = path.join(process.cwd(), 'web', 'public', 'uploads', 'blog-covers');
  if (fs.existsSync(path.join(process.cwd(), 'web', 'public'))) {
    if (!fs.existsSync(webPublicDir)) fs.mkdirSync(webPublicDir, { recursive: true });
    fs.writeFileSync(path.join(webPublicDir, filename), buffer);
  }
}

export async function processAndSaveImage(
  buffer: Buffer,
  slug: string,
  credit: string
): Promise<StoredCoverResult> {
  const cleanSlug = (slug || 'article').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40);
  const filename = `cover_${cleanSlug}_${Date.now()}.webp`;

  const webpBuffer = await sharp(buffer)
    .resize({ width: 1200, height: 675, fit: 'cover', position: 'center' })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  writeBufferToUploads(filename, webpBuffer);
  await recordInSupabaseStorage(filename, webpBuffer.length);

  return {
    coverImageUrl: `/api/blog/images/${filename}`,
    coverImageCredit: credit,
  };
}

export async function processAndSaveInlineImage(
  buffer: Buffer,
  originalFilename = 'image',
  altText = 'Gambar Blog'
): Promise<{ url: string; alt: string; filename: string }> {
  const cleanName = path
    .basename(originalFilename, path.extname(originalFilename))
    .replace(/[^a-z0-9_-]/gi, '-')
    .slice(0, 40) || 'inline';
  const filename = `inline_${cleanName}_${Date.now()}.webp`;

  const webpBuffer = await sharp(buffer)
    .resize({ width: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  writeBufferToUploads(filename, webpBuffer);
  await recordInSupabaseStorage(filename, webpBuffer.length);

  return {
    url: `/api/blog/images/${filename}`,
    alt: altText || cleanName,
    filename,
  };
}

export async function fetchAndProcessArticleCover(
  title: string,
  category: string,
  tags: string[] = [],
  slug = 'article'
): Promise<StoredCoverResult> {
  const query = buildSearchQuery(title, category, tags);
  const candidates = await searchPexelsPhotos(query, 1);

  if (candidates.length > 0) {
    try {
      const buffer = await fetchImageBuffer(candidates[0].url);
      return await processAndSaveImage(buffer, slug, candidates[0].credit);
    } catch (err: any) {
      logger.warn(`[Pexels] Image download failed for "${title}": ${err.message}`);
    }
  }

  const placeholderSvg = generateBrandedPlaceholderSvg(title, category);
  return await processAndSaveImage(placeholderSvg, slug, 'MayStudio Creative Hub');
}

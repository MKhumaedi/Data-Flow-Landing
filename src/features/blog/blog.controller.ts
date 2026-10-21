import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { blogService } from './blog.service';
import {
  buildSearchQuery,
  searchPexelsPhotos,
  processAndSaveImage,
  processAndSaveInlineImage,
  generateBrandedPlaceholderSvg,
} from './pexelsImageService';

export class BlogController {
  // Admin: Upload and process inline article image
  async uploadInlineImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'Tidak ada file gambar yang diunggah' });
        return;
      }
      const altText = (req.body?.alt as string) || req.file.originalname || 'Gambar Blog';
      const result = await processAndSaveInlineImage(req.file.buffer, req.file.originalname, altText);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Public: Serve blog cover image
  async serveCoverImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      const cleanFilename = path.basename(filename);
      const possiblePaths = [
        path.join(process.cwd(), 'public', 'uploads', 'blog-covers', cleanFilename),
        path.join(process.cwd(), 'web', 'public', 'uploads', 'blog-covers', cleanFilename),
      ];

      const foundPath = possiblePaths.find((p) => fs.existsSync(p));
      if (!foundPath) {
        res.status(404).send('Image not found');
        return;
      }

      res.setHeader('Content-Type', 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      fs.createReadStream(foundPath).pipe(res);
    } catch (err) {
      next(err);
    }
  }

  // Admin/Public: Search Pexels photos
  async searchPexels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, category, tags, query } = req.body || {};
      const actualQuery = query || buildSearchQuery(title || '', category || '', tags || []);
      const candidates = await searchPexelsPhotos(actualQuery, 6);
      res.json({ success: true, query: actualQuery, data: candidates });
    } catch (err) {
      next(err);
    }
  }

  // Admin: Select and process Pexels photo
  async selectPexelsPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { photoUrl, photographer, slug, title, category } = req.body || {};
      if (!photoUrl) {
        const placeholderBuf = generateBrandedPlaceholderSvg(title || 'Artikel', category || 'MayStudio');
        const saved = await processAndSaveImage(placeholderBuf, slug || 'article', 'MayStudio Creative Hub');
        res.json({ success: true, data: saved });
        return;
      }

      const resImg = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
      if (!resImg.ok) {
        throw new Error(`Failed to download Pexels image (${resImg.status})`);
      }
      const buffer = Buffer.from(await resImg.arrayBuffer());
      const credit = photographer ? `Photo by ${photographer} on Pexels` : 'Photo on Pexels';
      const saved = await processAndSaveImage(buffer, slug || 'article', credit);
      res.json({ success: true, data: saved });
    } catch (err: any) {
      // Fall back to branded placeholder on download error
      try {
        const { title, category, slug } = req.body || {};
        const placeholderBuf = generateBrandedPlaceholderSvg(title || 'Artikel', category || 'MayStudio');
        const saved = await processAndSaveImage(placeholderBuf, slug || 'article', 'MayStudio Creative Hub');
        res.json({ success: true, data: saved, fallback: true, warning: err.message });
      } catch (fallbackErr) {
        next(fallbackErr);
      }
    }
  }

  // Admin: Generate branded placeholder
  async generatePlaceholder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, category, slug } = req.body || {};
      const placeholderBuf = generateBrandedPlaceholderSvg(title || 'Artikel', category || 'MayStudio');
      const saved = await processAndSaveImage(placeholderBuf, slug || 'article', 'MayStudio Creative Hub');
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  }

  // Public: List published blog posts
  async listPublic(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, search, tag, page, limit } = req.query;
      const result = await blogService.listPublished({
        category: category as string,
        search: search as string,
        tag: tag as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 9,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Public: Get post by slug
  async getBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug } = req.params;
      const post = await blogService.getBySlug(slug);
      if (!post) {
        res.status(404).json({ success: false, error: 'Artikel tidak ditemukan' });
        return;
      }
      const related = await blogService.getRelatedPosts(post.slug, post.category, 3);
      res.json({ success: true, data: { post, related } });
    } catch (err) {
      next(err);
    }
  }

  // Public: List categories
  async getCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await blogService.getCategories();
      res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  // Admin: List all posts (including drafts and deleted)
  async listAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, category, search, includeDeleted, page, limit } = req.query;
      const result = await blogService.listAllAdmin({
        status: status as string,
        category: category as string,
        search: search as string,
        includeDeleted: includeDeleted === 'true',
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  // Admin: Get single post
  async getAdminById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const post = await blogService.getAdminById(id);
      if (!post) {
        res.status(404).json({ success: false, error: 'Artikel tidak ditemukan' });
        return;
      }
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }

  // Admin: Create new post
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const admin = (req as any).user || { id: 'superadmin', email: 'superadmin@maystudio.id' };
      const { title, excerpt, contentMarkdown, category } = req.body;
      if (!title || !excerpt || !contentMarkdown || !category) {
        res.status(400).json({ success: false, error: 'Judul, ringkasan, isi markdown, dan kategori wajib diisi' });
        return;
      }
      const post = await blogService.create(req.body, admin);
      res.status(201).json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }

  // Admin: Update post
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const admin = (req as any).user || { id: 'superadmin', email: 'superadmin@maystudio.id' };
      const post = await blogService.update(id, req.body, admin);
      if (!post) {
        res.status(404).json({ success: false, error: 'Artikel tidak ditemukan' });
        return;
      }
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }

  // Admin: Toggle status
  async toggleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const admin = (req as any).user || { id: 'superadmin', email: 'superadmin@maystudio.id' };
      const post = await blogService.toggleStatus(id, admin);
      if (!post) {
        res.status(404).json({ success: false, error: 'Artikel tidak ditemukan' });
        return;
      }
      res.json({ success: true, data: post });
    } catch (err) {
      next(err);
    }
  }

  // Admin: Soft delete
  async softDelete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const admin = (req as any).user || { id: 'superadmin', email: 'superadmin@maystudio.id' };
      const success = await blogService.softDelete(id, admin);
      if (!success) {
        res.status(404).json({ success: false, error: 'Artikel tidak ditemukan' });
        return;
      }
      res.json({ success: true, message: 'Artikel berhasil dihapus' });
    } catch (err) {
      next(err);
    }
  }

  // Admin: Restore post
  async restore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const admin = (req as any).user || { id: 'superadmin', email: 'superadmin@maystudio.id' };
      const success = await blogService.restore(id, admin);
      if (!success) {
        res.status(404).json({ success: false, error: 'Artikel tidak ditemukan' });
        return;
      }
      res.json({ success: true, message: 'Artikel berhasil dipulihkan' });
    } catch (err) {
      next(err);
    }
  }
}

export const blogController = new BlogController();

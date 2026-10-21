import { Client } from 'pg';
import { BlogPostItem, CreateBlogPostDto, UpdateBlogPostDto, BlogListQuery, AdminBlogListQuery, BlogAdminStats } from './blog.types';
import { INITIAL_BLOG_SEEDS } from './blog.seed';
import { logAdminAction } from '../admin/audit-log/audit.helper';
import { logger } from '../../lib/logger';
import { notificationService } from '../notifications/notification.service';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

class BlogService {
  private inMemoryStore: BlogPostItem[] = JSON.parse(JSON.stringify(INITIAL_BLOG_SEEDS));
  private isInitialized = false;

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  private async ensureTableAndSeeds(client: Client): Promise<void> {
    if (this.isInitialized) return;
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "blog_posts" (
          "id" TEXT PRIMARY KEY,
          "slug" TEXT UNIQUE NOT NULL,
          "title" TEXT NOT NULL,
          "excerpt" TEXT NOT NULL,
          "contentMarkdown" TEXT NOT NULL,
          "coverImageUrl" TEXT,
          "coverImageCredit" TEXT,
          "category" TEXT NOT NULL,
          "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "authorName" TEXT DEFAULT 'Tim MayStudio' NOT NULL,
          "status" TEXT DEFAULT 'DRAFT' NOT NULL,
          "publishedAt" TIMESTAMP WITH TIME ZONE,
          "metaTitle" TEXT,
          "metaDescription" TEXT,
          "viewCount" INTEGER DEFAULT 0 NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          "deletedAt" TIMESTAMP WITH TIME ZONE
        );
        ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "coverImageCredit" TEXT;
        CREATE INDEX IF NOT EXISTS "idx_blog_posts_slug" ON "blog_posts" ("slug");
        CREATE INDEX IF NOT EXISTS "idx_blog_posts_category" ON "blog_posts" ("category");
        CREATE INDEX IF NOT EXISTS "idx_blog_posts_status" ON "blog_posts" ("status");
        CREATE INDEX IF NOT EXISTS "idx_blog_posts_publishedAt" ON "blog_posts" ("publishedAt");
      `);

      for (const item of INITIAL_BLOG_SEEDS) {
        await client.query(
          `INSERT INTO "blog_posts" (
            "id", "slug", "title", "excerpt", "contentMarkdown", "coverImageUrl", "coverImageCredit",
            "category", "tags", "authorName", "status", "publishedAt", "metaTitle",
            "metaDescription", "viewCount", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
          ON CONFLICT ("slug") DO UPDATE SET
            "title" = EXCLUDED."title",
            "excerpt" = EXCLUDED."excerpt",
            "contentMarkdown" = EXCLUDED."contentMarkdown",
            "coverImageUrl" = COALESCE(EXCLUDED."coverImageUrl", "blog_posts"."coverImageUrl"),
            "coverImageCredit" = COALESCE(EXCLUDED."coverImageCredit", "blog_posts"."coverImageCredit"),
            "category" = EXCLUDED."category",
            "tags" = EXCLUDED."tags",
            "status" = EXCLUDED."status",
            "publishedAt" = EXCLUDED."publishedAt",
            "metaTitle" = EXCLUDED."metaTitle",
            "metaDescription" = EXCLUDED."metaDescription",
            "updatedAt" = NOW()`,
          [
            item.id,
            item.slug,
            item.title,
            item.excerpt,
            item.contentMarkdown,
            item.coverImageUrl || null,
            item.coverImageCredit || null,
            item.category,
            item.tags,
            item.authorName,
            item.status,
            item.publishedAt ? new Date(item.publishedAt) : new Date(),
            item.metaTitle || null,
            item.metaDescription || null,
            item.viewCount || 0,
          ]
        );
      }
      this.isInitialized = true;
    } catch (e: any) {
      logger.warn(`[BlogService] ensureTableAndSeeds: ${e.message}`);
    }
  }

  private async notifyPostPublished(post: BlogPostItem): Promise<void> {
    try {
      await notificationService.createNotification({
        scope: 'BROADCAST',
        userId: null,
        type: 'CONTENT_UPDATE',
        title: 'Artikel Baru',
        message: `Artikel baru: ${post.title}`,
        link: `/blog/${post.slug}`,
      });
    } catch (err: any) {
      logger.warn(`[BlogService] Publish notification error: ${err.message}`);
    }
  }

  private mapRow(row: any): BlogPostItem {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      contentMarkdown: row.contentMarkdown,
      coverImageUrl: row.coverImageUrl || null,
      coverImageCredit: row.coverImageCredit || null,
      category: row.category,
      tags: Array.isArray(row.tags) ? row.tags : [],
      authorName: row.authorName || 'Tim MayStudio',
      status: (row.status as any) || 'DRAFT',
      publishedAt: row.publishedAt || null,
      metaTitle: row.metaTitle || null,
      metaDescription: row.metaDescription || null,
      viewCount: Number(row.viewCount) || 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt || null,
    };
  }

  async listPublished(query: BlogListQuery = {}): Promise<{ posts: BlogPostItem[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 9));
    const offset = (page - 1) * limit;

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureTableAndSeeds(client);

        const conditions: string[] = [`"status" = 'PUBLISHED'`, `"deletedAt" IS NULL`];
        const values: any[] = [];
        let p = 1;

        if (query.category && query.category !== 'Semua') {
          conditions.push(`"category" = $${p++}`);
          values.push(query.category);
        }
        if (query.search && query.search.trim()) {
          conditions.push(`("title" ILIKE $${p} OR "excerpt" ILIKE $${p} OR "contentMarkdown" ILIKE $${p})`);
          values.push(`%${query.search.trim()}%`);
          p++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countRes = await client.query(`SELECT COUNT(*) FROM "blog_posts" ${whereClause}`, values);
        const total = parseInt(countRes.rows[0].count, 10);

        const dataRes = await client.query(
          `SELECT * FROM "blog_posts" ${whereClause} ORDER BY "publishedAt" DESC NULLS LAST, "createdAt" DESC LIMIT $${p++} OFFSET $${p++}`,
          [...values, limit, offset]
        );

        return {
          posts: dataRes.rows.map(this.mapRow),
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1,
        };
      } catch (err: any) {
        logger.warn(`[BlogService] listPublished db error: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    let filtered = this.inMemoryStore.filter((p) => p.status === 'PUBLISHED' && !p.deletedAt);
    if (query.category && query.category !== 'Semua') {
      filtered = filtered.filter((p) => p.category === query.category);
    }
    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter((p) => p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    return {
      posts: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getBySlug(slug: string): Promise<BlogPostItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureTableAndSeeds(client);
        const res = await client.query(
          `UPDATE "blog_posts" SET "viewCount" = "viewCount" + 1 WHERE "slug" = $1 AND "status" = 'PUBLISHED' AND "deletedAt" IS NULL RETURNING *`,
          [slug]
        );
        if (res.rows.length > 0) {
          return this.mapRow(res.rows[0]);
        }
      } catch (err: any) {
        logger.warn(`[BlogService] getBySlug db error: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    const post = this.inMemoryStore.find((p) => p.slug === slug && p.status === 'PUBLISHED' && !p.deletedAt);
    if (post) {
      post.viewCount = (post.viewCount || 0) + 1;
      return post;
    }
    return null;
  }

  async getRelatedPosts(currentSlug: string, category: string, limit = 3): Promise<BlogPostItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `SELECT * FROM "blog_posts" 
           WHERE "slug" != $1 AND "status" = 'PUBLISHED' AND "deletedAt" IS NULL 
           ORDER BY (CASE WHEN "category" = $2 THEN 0 ELSE 1 END), "publishedAt" DESC LIMIT $3`,
          [currentSlug, category, limit]
        );
        return res.rows.map(this.mapRow);
      } catch (err: any) {
        logger.warn(`[BlogService] getRelatedPosts db error: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    return this.inMemoryStore
      .filter((p) => p.slug !== currentSlug && p.status === 'PUBLISHED' && !p.deletedAt)
      .sort((a, b) => (a.category === category ? -1 : 1))
      .slice(0, limit);
  }

  async getCategories(): Promise<Array<{ name: string; count: number }>> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureTableAndSeeds(client);
        const res = await client.query(
          `SELECT "category" as name, COUNT(*)::int as count 
           FROM "blog_posts" 
           WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL 
           GROUP BY "category" 
           ORDER BY count DESC, name ASC`
        );
        return res.rows;
      } catch (err: any) {
        logger.warn(`[BlogService] getCategories db error: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    const counts: Record<string, number> = {};
    for (const post of this.inMemoryStore) {
      if (post.status === 'PUBLISHED' && !post.deletedAt) {
        counts[post.category] = (counts[post.category] || 0) + 1;
      }
    }
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }

  async listAllAdmin(query: AdminBlogListQuery = {}): Promise<{ posts: BlogPostItem[]; total: number; page: number; totalPages: number; stats?: BlogAdminStats }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 25));
    const offset = (page - 1) * limit;

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureTableAndSeeds(client);

        const conditions: string[] = [];
        const values: any[] = [];
        let p = 1;

        if (!query.includeDeleted) {
          conditions.push(`"deletedAt" IS NULL`);
        }
        if (query.status && query.status !== 'ALL') {
          conditions.push(`"status" = $${p++}`);
          values.push(query.status);
        }
        if (query.category && query.category !== 'Semua') {
          conditions.push(`"category" = $${p++}`);
          values.push(query.category);
        }
        if (query.search && query.search.trim()) {
          conditions.push(`("title" ILIKE $${p} OR "excerpt" ILIKE $${p} OR "slug" ILIKE $${p})`);
          values.push(`%${query.search.trim()}%`);
          p++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const countRes = await client.query(`SELECT COUNT(*) FROM "blog_posts" ${whereClause}`, values);
        const total = parseInt(countRes.rows[0].count, 10);

        const dataRes = await client.query(
          `SELECT * FROM "blog_posts" ${whereClause} ORDER BY "createdAt" DESC LIMIT $${p++} OFFSET $${p++}`,
          [...values, limit, offset]
        );

        // Overall stats (independent of pagination and specific list filters)
        const statsRes = await client.query(`
          SELECT
            COUNT(*) FILTER (WHERE "deletedAt" IS NULL)::int as total,
            COUNT(*) FILTER (WHERE "status" = 'PUBLISHED' AND "deletedAt" IS NULL)::int as published,
            COUNT(*) FILTER (WHERE "status" = 'DRAFT' AND "deletedAt" IS NULL)::int as draft,
            COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)::int as deleted,
            COALESCE(SUM("viewCount") FILTER (WHERE "deletedAt" IS NULL), 0)::int as total_views
          FROM "blog_posts"
        `);
        const statsRow = statsRes.rows[0] || {};
        const stats: BlogAdminStats = {
          total: Number(statsRow.total) || 0,
          published: Number(statsRow.published) || 0,
          draft: Number(statsRow.draft) || 0,
          deleted: Number(statsRow.deleted) || 0,
          totalViews: Number(statsRow.total_views) || 0,
        };

        return {
          posts: dataRes.rows.map(this.mapRow),
          total,
          page,
          totalPages: Math.ceil(total / limit) || 1,
          stats,
        };
      } catch (err: any) {
        logger.warn(`[BlogService] listAllAdmin db error: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    let filtered = query.includeDeleted ? [...this.inMemoryStore] : this.inMemoryStore.filter((p) => !p.deletedAt);
    if (query.status && query.status !== 'ALL') {
      filtered = filtered.filter((p) => p.status === query.status);
    }
    if (query.category && query.category !== 'Semua') {
      filtered = filtered.filter((p) => p.category === query.category);
    }
    if (query.search && query.search.trim()) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
    }
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);
    const stats: BlogAdminStats = {
      total: this.inMemoryStore.filter((p) => !p.deletedAt).length,
      published: this.inMemoryStore.filter((p) => p.status === 'PUBLISHED' && !p.deletedAt).length,
      draft: this.inMemoryStore.filter((p) => p.status === 'DRAFT' && !p.deletedAt).length,
      deleted: this.inMemoryStore.filter((p) => !!p.deletedAt).length,
      totalViews: this.inMemoryStore.filter((p) => !p.deletedAt).reduce((acc, p) => acc + (p.viewCount || 0), 0),
    };

    return {
      posts: paginated,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
      stats,
    };
  }

  async getAdminById(id: string): Promise<BlogPostItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(`SELECT * FROM "blog_posts" WHERE "id" = $1 LIMIT 1`, [id]);
        if (res.rows.length > 0) return this.mapRow(res.rows[0]);
      } catch (err: any) {
        logger.warn(`[BlogService] getAdminById db error: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }
    return this.inMemoryStore.find((p) => p.id === id) || null;
  }

  async create(dto: CreateBlogPostDto, admin: { id: string; email: string }): Promise<BlogPostItem> {
    const id = `post-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const slug = (dto.slug || dto.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).toLowerCase();
    const status = dto.status || 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? (dto.publishedAt ? new Date(dto.publishedAt) : new Date()) : null;
    const tags = Array.isArray(dto.tags) ? dto.tags : [];
    const authorName = dto.authorName || 'Tim MayStudio';

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `INSERT INTO "blog_posts" (
            "id", "slug", "title", "excerpt", "contentMarkdown", "coverImageUrl", "coverImageCredit",
            "category", "tags", "authorName", "status", "publishedAt", "metaTitle",
            "metaDescription", "viewCount", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 0, NOW(), NOW())
          RETURNING *`,
          [
            id,
            slug,
            dto.title,
            dto.excerpt,
            dto.contentMarkdown,
            dto.coverImageUrl || null,
            dto.coverImageCredit || null,
            dto.category,
            tags,
            authorName,
            status,
            publishedAt,
            dto.metaTitle || null,
            dto.metaDescription || null,
          ]
        );
        const item = this.mapRow(res.rows[0]);
        await logAdminAction({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'CREATE_BLOG_POST',
          targetType: 'BLOG_POST',
          targetId: item.id,
          details: { title: item.title, slug: item.slug, status: item.status },
        });
        if (item.status === 'PUBLISHED') {
          this.notifyPostPublished(item);
        }
        return item;
      } catch (err: any) {
        logger.warn(`[BlogService] create db fallback: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    const newItem: BlogPostItem = {
      id,
      slug,
      title: dto.title,
      excerpt: dto.excerpt,
      contentMarkdown: dto.contentMarkdown,
      coverImageUrl: dto.coverImageUrl || null,
      coverImageCredit: dto.coverImageCredit || null,
      category: dto.category,
      tags,
      authorName,
      status,
      publishedAt,
      metaTitle: dto.metaTitle || null,
      metaDescription: dto.metaDescription || null,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.inMemoryStore.unshift(newItem);
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CREATE_BLOG_POST',
      targetType: 'BLOG_POST',
      targetId: newItem.id,
      details: { title: newItem.title, slug: newItem.slug, status: newItem.status },
    });
    if (newItem.status === 'PUBLISHED') {
      this.notifyPostPublished(newItem);
    }
    return newItem;
  }

  async update(id: string, dto: UpdateBlogPostDto, admin: { id: string; email: string }): Promise<BlogPostItem | null> {
    const previousPost = await this.getAdminById(id);
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const updates: string[] = ['"updatedAt" = NOW()'];
        const values: any[] = [];
        let p = 1;

        if (dto.title !== undefined) { updates.push(`"title" = $${p++}`); values.push(dto.title); }
        if (dto.slug !== undefined) { updates.push(`"slug" = $${p++}`); values.push(dto.slug.toLowerCase()); }
        if (dto.excerpt !== undefined) { updates.push(`"excerpt" = $${p++}`); values.push(dto.excerpt); }
        if (dto.contentMarkdown !== undefined) { updates.push(`"contentMarkdown" = $${p++}`); values.push(dto.contentMarkdown); }
        if (dto.coverImageUrl !== undefined) { updates.push(`"coverImageUrl" = $${p++}`); values.push(dto.coverImageUrl || null); }
        if (dto.coverImageCredit !== undefined) { updates.push(`"coverImageCredit" = $${p++}`); values.push(dto.coverImageCredit || null); }
        if (dto.category !== undefined) { updates.push(`"category" = $${p++}`); values.push(dto.category); }
        if (dto.tags !== undefined) { updates.push(`"tags" = $${p++}`); values.push(Array.isArray(dto.tags) ? dto.tags : []); }
        if (dto.authorName !== undefined) { updates.push(`"authorName" = $${p++}`); values.push(dto.authorName); }
        if (dto.status !== undefined) {
          updates.push(`"status" = $${p++}`);
          values.push(dto.status);
          if (dto.status === 'PUBLISHED') {
            updates.push(`"publishedAt" = COALESCE("publishedAt", NOW())`);
          }
        }
        if (dto.publishedAt !== undefined) {
          updates.push(`"publishedAt" = $${p++}`);
          values.push(dto.publishedAt ? new Date(dto.publishedAt) : null);
        }
        if (dto.metaTitle !== undefined) { updates.push(`"metaTitle" = $${p++}`); values.push(dto.metaTitle || null); }
        if (dto.metaDescription !== undefined) { updates.push(`"metaDescription" = $${p++}`); values.push(dto.metaDescription || null); }

        values.push(id);
        const res = await client.query(
          `UPDATE "blog_posts" SET ${updates.join(', ')} WHERE "id" = $${p} RETURNING *`,
          values
        );
        if (res.rows.length > 0) {
          const updated = this.mapRow(res.rows[0]);
          await logAdminAction({
            adminId: admin.id,
            adminEmail: admin.email,
            action: 'UPDATE_BLOG_POST',
            targetType: 'BLOG_POST',
            targetId: id,
            details: { title: updated.title, status: updated.status },
          });
          if (updated.status === 'PUBLISHED' && previousPost?.status !== 'PUBLISHED') {
            this.notifyPostPublished(updated);
          }
          return updated;
        }
      } catch (err: any) {
        logger.warn(`[BlogService] update db fallback: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    const idx = this.inMemoryStore.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const existing = this.inMemoryStore[idx];
    const newStatus = dto.status !== undefined ? dto.status : existing.status;
    const publishedAt =
      dto.publishedAt !== undefined
        ? dto.publishedAt ? new Date(dto.publishedAt) : null
        : newStatus === 'PUBLISHED' && !existing.publishedAt
        ? new Date()
        : existing.publishedAt;

    this.inMemoryStore[idx] = {
      ...existing,
      ...dto,
      status: newStatus,
      publishedAt,
      updatedAt: new Date(),
    };
    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_BLOG_POST',
      targetType: 'BLOG_POST',
      targetId: id,
      details: { title: this.inMemoryStore[idx].title, status: newStatus },
    });
    if (newStatus === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      this.notifyPostPublished(this.inMemoryStore[idx]);
    }
    return this.inMemoryStore[idx];
  }

  async toggleStatus(id: string, admin: { id: string; email: string }): Promise<BlogPostItem | null> {
    const current = await this.getAdminById(id);
    if (!current) return null;
    const nextStatus = current.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    return this.update(id, { status: nextStatus }, admin);
  }

  async softDelete(id: string, admin: { id: string; email: string }): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(`UPDATE "blog_posts" SET "deletedAt" = NOW() WHERE "id" = $1`, [id]);
        await logAdminAction({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'DELETE_BLOG_POST',
          targetType: 'BLOG_POST',
          targetId: id,
          details: { id },
        });
        return true;
      } catch (err: any) {
        logger.warn(`[BlogService] softDelete db fallback: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    const idx = this.inMemoryStore.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.inMemoryStore[idx].deletedAt = new Date();
      await logAdminAction({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'DELETE_BLOG_POST',
        targetType: 'BLOG_POST',
        targetId: id,
        details: { id },
      });
      return true;
    }
    return false;
  }

  async restore(id: string, admin: { id: string; email: string }): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(`UPDATE "blog_posts" SET "deletedAt" = NULL WHERE "id" = $1`, [id]);
        await logAdminAction({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'RESTORE_BLOG_POST',
          targetType: 'BLOG_POST',
          targetId: id,
          details: { id },
        });
        return true;
      } catch (err: any) {
        logger.warn(`[BlogService] restore db fallback: ${err.message}`);
      } finally {
        try { await client.end(); } catch {}
      }
    }

    const idx = this.inMemoryStore.findIndex((p) => p.id === id);
    if (idx !== -1) {
      this.inMemoryStore[idx].deletedAt = null;
      await logAdminAction({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'RESTORE_BLOG_POST',
        targetType: 'BLOG_POST',
        targetId: id,
        details: { id },
      });
      return true;
    }
    return false;
  }
}

export const blogService = new BlogService();

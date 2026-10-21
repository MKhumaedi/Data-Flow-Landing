import { Client } from 'pg';
import { FormTemplateItem, CreateFormTemplateDto, UpdateFormTemplateDto } from './form.types';
import { INITIAL_FORM_SEEDS } from './form.seed';
import { logger } from '../../lib/logger';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

class FormService {
  private inMemoryStore: FormTemplateItem[] = JSON.parse(JSON.stringify(INITIAL_FORM_SEEDS));
  private isInitialized = false;

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  private async ensureSeeded(client: Client): Promise<void> {
    if (this.isInitialized) return;
    try {
      const validSlugs = INITIAL_FORM_SEEDS.map((s) => s.slug);
      if (validSlugs.length > 0) {
        const placeholders = validSlugs.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `UPDATE "form_templates" SET "deletedAt" = NOW() WHERE "slug" NOT IN (${placeholders}) AND "deletedAt" IS NULL`,
          validSlugs
        );
      }

      for (const item of INITIAL_FORM_SEEDS) {
        await client.query(
          `INSERT INTO "form_templates" ("id", "slug", "category", "title", "description", "fields", "order", "isPublished", "createdAt", "updatedAt", "deletedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NULL)
           ON CONFLICT ("slug") DO UPDATE SET
             "category" = EXCLUDED."category",
             "title" = EXCLUDED."title",
             "description" = EXCLUDED."description",
             "fields" = EXCLUDED."fields",
             "order" = EXCLUDED."order",
             "isPublished" = EXCLUDED."isPublished",
             "deletedAt" = NULL,
             "updatedAt" = NOW()`,
          [
            item.id,
            item.slug,
            item.category,
            item.title,
            item.description,
            JSON.stringify(item.fields),
            item.order,
            item.isPublished,
          ]
        );
      }
      this.isInitialized = true;
    } catch (e: any) {
      logger.warn(`[FormService] ensureSeeded check: ${e.message}`);
    }
  }

  private mapRow(row: any): FormTemplateItem {
    return {
      id: row.id,
      slug: row.slug,
      category: row.category,
      title: row.title,
      description: row.description,
      fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
      order: row.order ?? 0,
      isPublished: row.isPublished ?? true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt || null,
    };
  }

  async listPublished(): Promise<FormTemplateItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const res = await client.query(
          `SELECT * FROM "form_templates" 
           WHERE "isPublished" = true AND "deletedAt" IS NULL 
           ORDER BY "category" ASC, "order" ASC, "createdAt" ASC`
        );
        return res.rows.map(this.mapRow);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }
    return this.inMemoryStore
      .filter((f) => f.isPublished && !f.deletedAt)
      .sort((a, b) => (a.category === b.category ? a.order - b.order : a.category.localeCompare(b.category)));
  }

  async getBySlug(slug: string): Promise<FormTemplateItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const res = await client.query(
          `SELECT * FROM "form_templates" WHERE "slug" = $1 AND "deletedAt" IS NULL LIMIT 1`,
          [slug]
        );
        if (res.rows.length > 0) return this.mapRow(res.rows[0]);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }
    return this.inMemoryStore.find((f) => f.slug === slug && !f.deletedAt) || null;
  }

  async listAllAdmin(includeDeleted = false): Promise<FormTemplateItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const query = includeDeleted
          ? `SELECT * FROM "form_templates" ORDER BY "category" ASC, "order" ASC, "createdAt" ASC`
          : `SELECT * FROM "form_templates" WHERE "deletedAt" IS NULL ORDER BY "category" ASC, "order" ASC, "createdAt" ASC`;
        const res = await client.query(query);
        return res.rows.map(this.mapRow);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }
    return this.inMemoryStore
      .filter((f) => includeDeleted || !f.deletedAt)
      .sort((a, b) => (a.category === b.category ? a.order - b.order : a.category.localeCompare(b.category)));
  }

  async create(dto: CreateFormTemplateDto): Promise<FormTemplateItem> {
    const id = `form-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const slug = (dto.slug || dto.title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const newItem: FormTemplateItem = {
      id,
      slug,
      category: dto.category,
      title: dto.title,
      description: dto.description,
      fields: dto.fields || [],
      order: dto.order ?? 0,
      isPublished: dto.isPublished ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };

    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const res = await client.query(
          `INSERT INTO "form_templates" ("id", "slug", "category", "title", "description", "fields", "order", "isPublished", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
           RETURNING *`,
          [
            newItem.id,
            newItem.slug,
            newItem.category,
            newItem.title,
            newItem.description,
            JSON.stringify(newItem.fields),
            newItem.order,
            newItem.isPublished,
          ]
        );
        this.inMemoryStore.push(newItem);
        return this.mapRow(res.rows[0]);
      } catch (err: any) {
        logger.warn(`[FormService] create fallback: ${err.message}`);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }

    this.inMemoryStore.push(newItem);
    return newItem;
  }

  async update(id: string, dto: UpdateFormTemplateDto): Promise<FormTemplateItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const updates: string[] = ['"updatedAt" = NOW()'];
        const values: any[] = [id];
        let idx = 2;

        if (dto.slug !== undefined) {
          updates.push(`"slug" = $${idx++}`);
          values.push(dto.slug);
        }
        if (dto.category !== undefined) {
          updates.push(`"category" = $${idx++}`);
          values.push(dto.category);
        }
        if (dto.title !== undefined) {
          updates.push(`"title" = $${idx++}`);
          values.push(dto.title);
        }
        if (dto.description !== undefined) {
          updates.push(`"description" = $${idx++}`);
          values.push(dto.description);
        }
        if (dto.fields !== undefined) {
          updates.push(`"fields" = $${idx++}`);
          values.push(JSON.stringify(dto.fields));
        }
        if (dto.order !== undefined) {
          updates.push(`"order" = $${idx++}`);
          values.push(dto.order);
        }
        if (dto.isPublished !== undefined) {
          updates.push(`"isPublished" = $${idx++}`);
          values.push(dto.isPublished);
        }

        const res = await client.query(
          `UPDATE "form_templates" SET ${updates.join(', ')} WHERE "id" = $1 RETURNING *`,
          values
        );
        if (res.rows.length > 0) {
          const updated = this.mapRow(res.rows[0]);
          const localIdx = this.inMemoryStore.findIndex((f) => f.id === id);
          if (localIdx >= 0) this.inMemoryStore[localIdx] = updated;
          return updated;
        }
      } catch (err: any) {
        logger.warn(`[FormService] update fallback: ${err.message}`);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }

    const index = this.inMemoryStore.findIndex((f) => f.id === id);
    if (index === -1) return null;
    const current = this.inMemoryStore[index];
    const updated: FormTemplateItem = {
      ...current,
      slug: dto.slug !== undefined ? dto.slug : current.slug,
      category: dto.category !== undefined ? dto.category : current.category,
      title: dto.title !== undefined ? dto.title : current.title,
      description: dto.description !== undefined ? dto.description : current.description,
      fields: dto.fields !== undefined ? dto.fields : current.fields,
      order: dto.order !== undefined ? dto.order : current.order,
      isPublished: dto.isPublished !== undefined ? dto.isPublished : current.isPublished,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryStore[index] = updated;
    return updated;
  }

  async softDelete(id: string): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        await client.query(`UPDATE "form_templates" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1`, [id]);
      } catch (err: any) {
        logger.warn(`[FormService] softDelete fallback: ${err.message}`);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }

    const item = this.inMemoryStore.find((f) => f.id === id);
    if (item) {
      item.deletedAt = new Date().toISOString();
      item.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  async restore(id: string): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        await client.query(`UPDATE "form_templates" SET "deletedAt" = NULL, "updatedAt" = NOW() WHERE "id" = $1`, [id]);
      } catch (err: any) {
        logger.warn(`[FormService] restore fallback: ${err.message}`);
      } finally {
        try {
          await client.end();
        } catch {}
      }
    }

    const item = this.inMemoryStore.find((f) => f.id === id);
    if (item) {
      item.deletedAt = null;
      item.updatedAt = new Date().toISOString();
      return true;
    }
    return false;
  }

  async bulkImport(items: any[]): Promise<{ importedCount: number; errors: { row: number; title: string; reason: string }[] }> {
    const errors: { row: number; title: string; reason: string }[] = [];
    const validItems: CreateFormTemplateDto[] = [];

    items.forEach((item, index) => {
      const row = index + 1;
      if (!item.title || typeof item.title !== 'string') {
        errors.push({ row, title: item.title || 'Untitled', reason: 'Field "title" wajib diisi string' });
        return;
      }
      if (!item.category || typeof item.category !== 'string') {
        errors.push({ row, title: item.title, reason: 'Field "category" wajib diisi' });
        return;
      }
      if (!item.description || typeof item.description !== 'string') {
        errors.push({ row, title: item.title, reason: 'Field "description" wajib diisi' });
        return;
      }
      if (!Array.isArray(item.fields) || item.fields.length === 0) {
        errors.push({ row, title: item.title, reason: 'Field "fields" harus berupa array berisi definisi field' });
        return;
      }

      // Validate each field
      let fieldError = '';
      for (const field of item.fields) {
        if (!field.type || !field.label) {
          fieldError = 'Setiap field harus memiliki "type" dan "label"';
          break;
        }
        if (field.type === 'select' && (!Array.isArray(field.options) || field.options.length === 0)) {
          fieldError = `Field "${field.label}" bertipe select harus memiliki array "options"`;
          break;
        }
        if (field.type === 'table' && (!Array.isArray(field.columns) || field.columns.length === 0)) {
          fieldError = `Field "${field.label}" bertipe table harus memiliki array "columns"`;
          break;
        }
      }

      if (fieldError) {
        errors.push({ row, title: item.title, reason: fieldError });
        return;
      }

      validItems.push({
        title: item.title,
        slug: item.slug || item.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: item.category,
        description: item.description,
        fields: item.fields,
        order: typeof item.order === 'number' ? item.order : 0,
        isPublished: item.isPublished ?? true,
      });
    });

    let importedCount = 0;
    for (const valid of validItems) {
      try {
        await this.create(valid);
        importedCount++;
      } catch (err: any) {
        errors.push({ row: 0, title: valid.title, reason: err.message || 'Gagal menyimpan ke database' });
      }
    }

    return { importedCount, errors };
  }
}

export const formService = new FormService();

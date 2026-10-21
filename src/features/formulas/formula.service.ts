import { Client } from 'pg';
import { FormulaItem, CreateFormulaDto, UpdateFormulaDto } from './formula.types';
import { INITIAL_FORMULA_SEEDS } from './formula.seed';
import { logger } from '../../lib/logger';
import { getSafePgClient, markDatabaseOffline } from '../../lib/db-connection';

class FormulaService {
  private inMemoryStore: FormulaItem[] = [...INITIAL_FORMULA_SEEDS];
  private isInitialized = false;

  private getPgClient(): Client | null {
    return getSafePgClient();
  }

  private async ensureSeeded(client: Client): Promise<void> {
    if (this.isInitialized) return;
    try {
      const countRes = await client.query('SELECT COUNT(*) FROM "formulas" WHERE "deletedAt" IS NULL');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        for (const item of INITIAL_FORMULA_SEEDS) {
          await client.query(
            `INSERT INTO "formulas" ("id", "slug", "name", "category", "shortDesc", "fullExplanation", "syntaxExample", "practiceData", "order", "isPublished", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             ON CONFLICT ("slug") DO NOTHING`,
            [
              item.id,
              item.slug,
              item.name,
              item.category,
              item.shortDesc,
              item.fullExplanation,
              item.syntaxExample,
              JSON.stringify(item.practiceData),
              item.order,
              item.isPublished,
            ]
          );
        }
      }
      this.isInitialized = true;
    } catch (e: any) {
      logger.warn(`[FormulaService] ensureSeeded check: ${e.message}`);
    }
  }

  async listPublished(): Promise<FormulaItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const res = await client.query(
          `SELECT * FROM "formulas" WHERE "isPublished" = true AND "deletedAt" IS NULL ORDER BY "order" ASC, "createdAt" ASC`
        );
        return res.rows.map(this.mapRow);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    return this.inMemoryStore.filter((f) => f.isPublished && !f.deletedAt).sort((a, b) => a.order - b.order);
  }

  async getBySlug(slug: string): Promise<FormulaItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const res = await client.query(
          `SELECT * FROM "formulas" WHERE "slug" = $1 AND "deletedAt" IS NULL LIMIT 1`,
          [slug]
        );
        if (res.rows.length > 0) return this.mapRow(res.rows[0]);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    return this.inMemoryStore.find((f) => f.slug === slug && !f.deletedAt) || null;
  }

  async listAllAdmin(includeDeleted = false): Promise<FormulaItem[]> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await this.ensureSeeded(client);
        const query = includeDeleted
          ? `SELECT * FROM "formulas" ORDER BY "order" ASC, "createdAt" ASC`
          : `SELECT * FROM "formulas" WHERE "deletedAt" IS NULL ORDER BY "order" ASC, "createdAt" ASC`;
        const res = await client.query(query);
        return res.rows.map(this.mapRow);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    return includeDeleted ? [...this.inMemoryStore] : this.inMemoryStore.filter((f) => !f.deletedAt);
  }

  async create(dto: CreateFormulaDto): Promise<FormulaItem> {
    const id = `form-${Date.now()}`;
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const order = dto.order ?? 0;
    const isPublished = dto.isPublished ?? true;
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `INSERT INTO "formulas" ("id", "slug", "name", "category", "shortDesc", "fullExplanation", "syntaxExample", "practiceData", "order", "isPublished", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           RETURNING *`,
          [
            id,
            slug,
            dto.name,
            dto.category,
            dto.shortDesc,
            dto.fullExplanation,
            dto.syntaxExample,
            JSON.stringify(dto.practiceData),
            order,
            isPublished,
          ]
        );
        return this.mapRow(res.rows[0]);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    const item: FormulaItem = {
      id,
      slug,
      name: dto.name,
      category: dto.category,
      shortDesc: dto.shortDesc,
      fullExplanation: dto.fullExplanation,
      syntaxExample: dto.syntaxExample,
      practiceData: dto.practiceData,
      order,
      isPublished,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inMemoryStore.push(item);
    return item;
  }

  async upsert(dto: CreateFormulaDto): Promise<FormulaItem> {
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const id = `form-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const order = dto.order ?? 0;
    const isPublished = dto.isPublished ?? true;
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const res = await client.query(
          `INSERT INTO "formulas" ("id", "slug", "name", "category", "shortDesc", "fullExplanation", "syntaxExample", "practiceData", "order", "isPublished", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           ON CONFLICT ("slug") DO UPDATE SET
             "name" = EXCLUDED."name",
             "category" = EXCLUDED."category",
             "shortDesc" = EXCLUDED."shortDesc",
             "fullExplanation" = EXCLUDED."fullExplanation",
             "syntaxExample" = EXCLUDED."syntaxExample",
             "practiceData" = EXCLUDED."practiceData",
             "order" = EXCLUDED."order",
             "isPublished" = EXCLUDED."isPublished",
             "deletedAt" = NULL,
             "updatedAt" = NOW()
           RETURNING *`,
          [
            id,
            slug,
            dto.name,
            dto.category,
            dto.shortDesc,
            dto.fullExplanation,
            dto.syntaxExample,
            JSON.stringify(dto.practiceData),
            order,
            isPublished,
          ]
        );
        return this.mapRow(res.rows[0]);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }

    const existingIdx = this.inMemoryStore.findIndex((f) => f.slug === slug);
    if (existingIdx >= 0) {
      this.inMemoryStore[existingIdx] = {
        ...this.inMemoryStore[existingIdx],
        name: dto.name,
        category: dto.category,
        shortDesc: dto.shortDesc,
        fullExplanation: dto.fullExplanation,
        syntaxExample: dto.syntaxExample,
        practiceData: dto.practiceData,
        order,
        isPublished,
        deletedAt: null,
        updatedAt: new Date(),
      };
      return this.inMemoryStore[existingIdx];
    }

    const item: FormulaItem = {
      id,
      slug,
      name: dto.name,
      category: dto.category,
      shortDesc: dto.shortDesc,
      fullExplanation: dto.fullExplanation,
      syntaxExample: dto.syntaxExample,
      practiceData: dto.practiceData,
      order,
      isPublished,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inMemoryStore.push(item);
    return item;
  }

  async update(id: string, dto: UpdateFormulaDto): Promise<FormulaItem | null> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        const updates: string[] = ['"updatedAt" = NOW()'];
        const values: any[] = [];
        let p = 1;

        if (dto.name !== undefined) { updates.push(`"name" = $${p++}`); values.push(dto.name); }
        if (dto.slug !== undefined) { updates.push(`"slug" = $${p++}`); values.push(dto.slug); }
        if (dto.category !== undefined) { updates.push(`"category" = $${p++}`); values.push(dto.category); }
        if (dto.shortDesc !== undefined) { updates.push(`"shortDesc" = $${p++}`); values.push(dto.shortDesc); }
        if (dto.fullExplanation !== undefined) { updates.push(`"fullExplanation" = $${p++}`); values.push(dto.fullExplanation); }
        if (dto.syntaxExample !== undefined) { updates.push(`"syntaxExample" = $${p++}`); values.push(dto.syntaxExample); }
        if (dto.practiceData !== undefined) { updates.push(`"practiceData" = $${p++}`); values.push(JSON.stringify(dto.practiceData)); }
        if (dto.order !== undefined) { updates.push(`"order" = $${p++}`); values.push(dto.order); }
        if (dto.isPublished !== undefined) { updates.push(`"isPublished" = $${p++}`); values.push(dto.isPublished); }

        values.push(id);
        const res = await client.query(
          `UPDATE "formulas" SET ${updates.join(', ')} WHERE "id" = $${p} RETURNING *`,
          values
        );
        if (res.rows.length > 0) return this.mapRow(res.rows[0]);
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    const idx = this.inMemoryStore.findIndex((f) => f.id === id);
    if (idx === -1) return null;
    this.inMemoryStore[idx] = { ...this.inMemoryStore[idx], ...dto, updatedAt: new Date() };
    return this.inMemoryStore[idx];
  }

  async softDelete(id: string): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(`UPDATE "formulas" SET "deletedAt" = NOW() WHERE "id" = $1`, [id]);
        return true;
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    const idx = this.inMemoryStore.findIndex((f) => f.id === id);
    if (idx !== -1) {
      this.inMemoryStore[idx].deletedAt = new Date();
      return true;
    }
    return false;
  }

  async restore(id: string): Promise<boolean> {
    const client = this.getPgClient();
    if (client) {
      try {
        await client.connect();
        await client.query(`UPDATE "formulas" SET "deletedAt" = NULL WHERE "id" = $1`, [id]);
        return true;
      } catch (err: any) {
        markDatabaseOffline(err);
      } finally {
        await client.end().catch(() => null);
      }
    }
    const idx = this.inMemoryStore.findIndex((f) => f.id === id);
    if (idx !== -1) {
      this.inMemoryStore[idx].deletedAt = null;
      return true;
    }
    return false;
  }

  private mapRow(row: any): FormulaItem {
    let practiceData = row.practiceData;
    if (typeof practiceData === 'string') {
      try {
        practiceData = JSON.parse(practiceData);
      } catch {
        practiceData = { headers: ['A', 'B'], rows: [] };
      }
    }
    return {
      ...row,
      practiceData: practiceData || { headers: ['A', 'B'], rows: [] },
    };
  }
}

export const formulaService = new FormulaService();
